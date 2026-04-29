import { Request, Response } from 'express';
import {
  getFarmerByPhone,
  upsertFarmer,
  createLoanApplication,
  createRepayment,
  getLatestLoan,
  getAllLoans,
  getSessionLangStep,
  createSession,
  Farmer,
  LoanApplication,
} from './db';
import { t, Lang, STATUS_LABELS, LENDERS } from './i18n';
import { sendSms } from './sms';
import { triggerMobileCheckout } from './payments';
import { getLoanStatusFromChain, getScoreFromChain } from './solana';
import { broadcast, maskPhone } from './events';

// ── Response helpers ───────────────────────────────────────────────────────

const con = (text: string) => `CON ${text}`;
const end = (text: string) => `END ${text}`;

function fmt(n: number): string {
  return n.toLocaleString('en-TZ');
}

function genRef(): string {
  return `VF-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

const PAYMENT_METHODS = ['M-Pesa', 'Airtel Money', 'Tigo Pesa', 'HaloPesa'];

// ── Loan amount table [farmSize 1-4][livestock 1-4] ────────────────────────
// farmSize: 1=1-3ac, 2=4-6ac, 3=7-15ac, 4=16+ac
// livestock: 1=none, 2=1-5, 3=6-15, 4=16+
const LOAN_TABLE: Record<string, Record<string, number>> = {
  '1': { '1':  80_000, '2': 120_000, '3': 160_000, '4': 200_000 },
  '2': { '1': 150_000, '2': 250_000, '3': 350_000, '4': 450_000 },
  '3': { '1': 300_000, '2': 450_000, '3': 600_000, '4': 750_000 },
  '4': { '1': 500_000, '2': 700_000, '3': 900_000, '4': 1_200_000 },
};

function calcLoanAmount(farmSize: string, livestock: string, activeLoan: string): number {
  const base = LOAN_TABLE[farmSize]?.[livestock] ?? 100_000;
  return activeLoan === '1' ? Math.round(base * 0.7) : base;
}

function farmSizeLabel(choice: string): string {
  return { '1': '1-3 acres', '2': '4-6 acres', '3': '7-15 acres', '4': '16+ acres' }[choice] ?? choice;
}

function livestockLabel(choice: string): string {
  return { '1': 'None', '2': '1-5 animals', '3': '6-15 animals', '4': '16+ animals' }[choice] ?? choice;
}

function cropLabel(choice: string): string {
  return {
    '1': 'Maize / Corn', '2': 'Rice', '3': 'Vegetables',
    '4': 'Cash crops', '5': 'Mixed / Other',
  }[choice] ?? choice;
}

// Simple score estimator from farmer data
function estimateScore(farmSize: string, livestock: string): number {
  const farmPts: Record<string, number>      = { '1': 40, '2': 68, '3': 85, '4': 100 };
  const livePts: Record<string, number>      = { '1': 20, '2': 55, '3': 72, '4': 100 };
  const f = farmPts[farmSize] ?? 50;
  const l = livePts[livestock] ?? 50;
  return Math.round((f * 0.4) + (l * 0.4) + 20); // 20 pts base repayment credit
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function ussdHandler(req: Request, res: Response): Promise<void> {
  const { sessionId, phoneNumber, text } = req.body as {
    sessionId: string;
    phoneNumber: string;
    text: string;
    serviceCode: string;
    networkCode: string;
  };

  res.set('Content-Type', 'text/plain');

  try {
    const response = await route(phoneNumber, text ?? '', sessionId);
    console.log(`[USSD] session=${sessionId} phone=${maskPhone(phoneNumber)} text="${text}" → ${response.slice(0, 80)}`);
    res.send(response);
  } catch (err) {
    console.error('[USSD] Unhandled error:', err);
    res.send(`END ${t('en').error}`);
  }
}

// ── Main router ────────────────────────────────────────────────────────────

async function route(phone: string, text: string, sessionId: string): Promise<string> {
  const farmer = await getFarmerByPhone(phone);
  const parts  = text === '' ? [] : text.split('*');

  // Register session on first dial
  const hadLangStep = await getSessionLangStep(sessionId);
  if (hadLangStep === null) {
    await createSession(sessionId, phone, false);
  }

  // Step 0: Language selection
  if (parts.length === 0) return con(t('en').welcomeNew);

  if (parts.length === 1) {
    const langChoice: Lang = parts[0] === '2' ? 'sw' : 'en';
    await upsertFarmer(phone, { preferred_language: langChoice });
    return con(t(langChoice).mainMenu);
  }

  const lang: Lang = parts[0] === '2' ? 'sw' : 'en';
  const menuParts  = parts.slice(1);

  if (menuParts.length === 0) return con(t(lang).mainMenu);

  return mainFlow(phone, lang, menuParts, farmer);
}

// ── Main menu dispatcher ───────────────────────────────────────────────────

async function mainFlow(
  phone: string,
  lang: Lang,
  parts: string[],
  farmer: Farmer | null,
): Promise<string> {
  const [choice, ...rest] = parts;

  switch (choice) {
    case '1': return flowApplyLoan(phone, lang, rest, farmer);
    case '2': return flowMyLoans(phone, lang, rest);
    case '3': return flowRepayLoan(phone, lang, rest);
    case '4': return flowCheckStatus(phone, lang, farmer);
    case '5': return flowWhyAmount(phone, lang, rest, farmer);
    case '6': return flowImproveScore(phone, lang, rest, farmer);
    case '7': return flowHelp(phone, lang, rest);
    case '0': return end(t(lang).about);
    default:  return end(t(lang).invalidOption);
  }
}

// ── Flow 1: Apply for Loan ─────────────────────────────────────────────────
//
// steps[0] = farmSize  (1-4)          Step 1
// steps[1] = cropType  (1-5)          Step 2
// steps[2] = livestock (1-4)          Step 3
// steps[3] = activeLoan (1=yes, 2=no) Step 4
// steps[4] = lender (1-5)            Step 5
// steps[5] = confirm (1=yes, 2=cancel)

async function flowApplyLoan(
  phone: string,
  lang: Lang,
  steps: string[],
  farmer: Farmer | null,
): Promise<string> {
  const i18n = t(lang);

  // Step 1 — farm size
  if (steps.length === 0) return con(i18n.applyFarmSize);
  const farmSize = steps[0];
  if (farmSize === '0') return con(i18n.mainMenu);
  if (!['1','2','3','4'].includes(farmSize)) return con(i18n.applyFarmSize);

  // Step 2 — crop type
  if (steps.length === 1) return con(i18n.applyCrop);
  const cropType = steps[1];
  if (cropType === '0') return con(i18n.applyFarmSize);
  if (!['1','2','3','4','5'].includes(cropType)) return con(i18n.applyCrop);

  // Step 3 — livestock
  if (steps.length === 2) return con(i18n.applyLivestock);
  const livestock = steps[2];
  if (livestock === '0') return con(i18n.applyCrop);
  if (!['1','2','3','4'].includes(livestock)) return con(i18n.applyLivestock);

  // Step 4 — active loan
  if (steps.length === 3) return con(i18n.applyActiveLoan);
  const activeLoan = steps[3];
  if (activeLoan === '0') return con(i18n.applyLivestock);
  if (!['1','2'].includes(activeLoan)) return con(i18n.applyActiveLoan);

  // If farmer has active loan, gate them
  if (activeLoan === '1') {
    const existingLoan = await getLatestLoan(phone);
    if (existingLoan && existingLoan.status !== 'repaid') {
      const balance = existingLoan.amount;
      if (steps.length === 4) {
        return con(i18n.hasActiveLoan(fmt(balance), existingLoan.reference));
      }
      // sub-choice: 1=repay, 2=back
      if (steps[4] === '1') return flowRepayLoan(phone, lang, []);
      return con(i18n.mainMenu);
    }
  }

  // Step 5 — choose lender
  if (steps.length === 4) return con(i18n.applyLender(i18n.lenderList()));
  const lenderChoice = steps[4];
  if (lenderChoice === '0') return con(i18n.applyActiveLoan);
  const lenderIdx = parseInt(lenderChoice, 10) - 1;
  if (isNaN(lenderIdx) || lenderIdx < 0 || lenderIdx >= LENDERS.length) {
    return con(i18n.applyLender(i18n.lenderList()));
  }
  const lenderName = LENDERS[lenderIdx];

  // Show confirmation
  const amount    = calcLoanAmount(farmSize, livestock, activeLoan);
  const formatted = fmt(amount);

  if (steps.length === 5) return con(i18n.confirmLoan(formatted, lenderName));

  const confirm = steps[5];
  if (confirm === '0') return con(i18n.applyLender(i18n.lenderList()));
  if (confirm === '2') return end(i18n.loanCancelled);
  if (confirm !== '1') return con(i18n.confirmLoan(formatted, lenderName));

  // ── Submit ─────────────────────────────────────────────────────────────
  const wallet = farmer?.wallet_address ?? undefined;
  const ref    = await createLoanApplication(phone, amount, wallet, {
    lenderName,
    cropType:  cropLabel(cropType),
    farmSize:  farmSizeLabel(farmSize),
    livestock: livestockLabel(livestock),
  });

  broadcast({
    type: 'loan_application',
    phone: maskPhone(phone),
    amount,
    reference: ref,
    lender: lenderName,
    lang,
    ts: new Date().toISOString(),
  });

  sendSms(phone, i18n.smsLoanReceived(ref, formatted, lenderName)).catch(console.error);

  return end(i18n.loanSubmitted(ref, lenderName));
}

// ── Flow 2: My Loans & Balance ─────────────────────────────────────────────
//
// steps[0] = choice (1=balance, 2=schedule, 3=history, 4=earlyRepay)
// steps[1] = sub-action for earlyRepay (1=confirm, 2=cancel)

async function flowMyLoans(
  phone: string,
  lang: Lang,
  steps: string[],
): Promise<string> {
  const i18n = t(lang);

  if (steps.length === 0) return con(i18n.myLoansMenu);

  const choice = steps[0];
  if (choice === '0') return con(i18n.mainMenu);

  const loan = await getLatestLoan(phone);
  if (!loan) return end(i18n.noLoans);

  const dueDate = new Date(loan.created_at);
  dueDate.setMonth(dueDate.getMonth() + 4);
  const dueFmt = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Derive paid / balance from repayments (simplified: assume 50% paid)
  const paid    = Math.round(loan.amount * 0.5);
  const balance = loan.amount - paid;

  if (choice === '1') {
    // Balance screen
    const screen = i18n.balanceScreen(
      loan.reference,
      fmt(loan.amount),
      fmt(paid),
      fmt(balance),
      dueFmt,
    );
    if (steps.length === 1) return con(screen);
    // sub-choice: 1=repay
    if (steps[1] === '1') return flowRepayLoan(phone, lang, []);
    return con(i18n.myLoansMenu);
  }

  if (choice === '2') {
    // Schedule screen (simplified 4-month schedule)
    const installment = Math.round(loan.amount / 4);
    const rows = [
      `Month 1  ${fmt(installment)} TZS  ${paid >= installment ? '✓' : '○'}`,
      `Month 2  ${fmt(installment)} TZS  ${paid >= installment * 2 ? '✓' : paid >= installment ? '●' : '○'}`,
      `Month 3  ${fmt(installment)} TZS  ○`,
      `Month 4  ${fmt(loan.amount - installment * 3)} TZS  ○`,
    ].join('\n');
    const screen = i18n.scheduleScreen(loan.reference, rows);
    if (steps.length === 1) return con(screen);
    if (steps[1] === '1') return flowRepayLoan(phone, lang, []);
    return con(i18n.myLoansMenu);
  }

  if (choice === '3') {
    // Loan history
    const loans = await getAllLoans(phone);
    const rows = loans.map((l: LoanApplication) => {
      const d = new Date(l.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      const st = STATUS_LABELS[lang][l.status] ?? l.status;
      return `${l.reference}\n  TZS ${fmt(l.amount)} — ${st} (${d})`;
    }).join('\n\n');
    return end(i18n.historyScreen(rows || i18n.noLoans));
  }

  if (choice === '4') {
    // Early repayment
    const interest  = Math.round(balance * 0.04); // 4% early discount
    const payNow    = balance - interest;
    const screen = i18n.earlyRepayScreen(
      loan.reference,
      fmt(balance),
      fmt(interest),
      fmt(payNow),
    );
    if (steps.length === 1) return con(screen);
    if (steps[1] === '2') return con(i18n.myLoansMenu);
    if (steps[1] === '0') return con(i18n.myLoansMenu);
    // Confirmed early repay
    if (steps[1] === '1') return flowRepayLoan(phone, lang, []);
    return con(screen);
  }

  return con(i18n.myLoansMenu);
}

// ── Flow 3: Repay Loan ─────────────────────────────────────────────────────
//
// steps[0] = amountChoice (1=50k, 2=100k, 3=full)
// steps[1] = paymentMethod (1-4)
// steps[2] = confirm (1=yes, 2=cancel)

async function flowRepayLoan(
  phone: string,
  lang:  Lang,
  steps: string[],
): Promise<string> {
  const i18n = t(lang);

  const loan = await getLatestLoan(phone);
  if (!loan) return end(i18n.repayNoLoan);

  // Simplified outstanding balance
  const paid    = Math.round(loan.amount * 0.5);
  const balance = loan.amount - paid;

  if (steps.length === 0) return con(i18n.repayAmountMenu(fmt(balance)));

  const amountChoice = steps[0];
  if (amountChoice === '0') return con(i18n.mainMenu);
  if (!['1','2','3'].includes(amountChoice)) return con(i18n.repayAmountMenu(fmt(balance)));

  const repayAmount = amountChoice === '1' ? 50_000 : amountChoice === '2' ? 100_000 : balance;

  if (steps.length === 1) return con(i18n.repayMethodMenu);

  const methodChoice = steps[1];
  if (methodChoice === '0') return con(i18n.repayAmountMenu(fmt(balance)));
  const methodIdx = parseInt(methodChoice, 10) - 1;
  if (isNaN(methodIdx) || methodIdx < 0 || methodIdx >= PAYMENT_METHODS.length) {
    return con(i18n.repayMethodMenu);
  }
  const method = PAYMENT_METHODS[methodIdx];

  if (steps.length === 2) {
    return con(i18n.confirmRepay(fmt(repayAmount), method, loan.reference));
  }

  if (steps[2] === '2') return end(i18n.repayCancelled);
  if (steps[2] !== '1') return con(i18n.confirmRepay(fmt(repayAmount), method, loan.reference));

  // ── Confirmed ─────────────────────────────────────────────────────────
  const checkout = await triggerMobileCheckout(phone, repayAmount, loan.reference);
  await createRepayment(phone, repayAmount, loan.reference, checkout.transactionId);

  broadcast({
    type: 'repayment',
    phone: maskPhone(phone),
    amount: repayAmount,
    reference: loan.reference,
    method,
    lang,
    ts: new Date().toISOString(),
  });

  sendSms(phone, i18n.smsRepayInitiated(fmt(repayAmount), loan.reference, method)).catch(console.error);

  return end(i18n.repayInitiated(fmt(repayAmount), method));
}

// ── Flow 4: Check Status ───────────────────────────────────────────────────

async function flowCheckStatus(
  phone: string,
  lang: Lang,
  farmer: Farmer | null,
): Promise<string> {
  const i18n = t(lang);

  // Try on-chain first when wallet is known
  if (farmer?.wallet_address) {
    const onChain = await getLoanStatusFromChain(farmer.wallet_address).catch(() => null);
    if (onChain) {
      const statusLabel = STATUS_LABELS[lang][onChain.status] ?? onChain.status;
      const amountTzs   = fmt(Math.round(onChain.principalLamports / 1_000));
      return end(i18n.loanStatus('on-chain', amountTzs, statusLabel, 'VeriFarm', 'Devnet'));
    }
  }

  const loan = await getLatestLoan(phone);
  if (!loan) return end(i18n.noLoans);

  const statusLabel = STATUS_LABELS[lang][loan.status] ?? loan.status;
  const date = new Date(loan.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  // lender_name stored in notes field (JSON), fall back gracefully
  let lenderName = 'VeriFarm';
  try {
    const notes = JSON.parse(loan.notes ?? '{}');
    if (notes.lenderName) lenderName = notes.lenderName;
  } catch {}

  return end(i18n.loanStatus(loan.reference, fmt(loan.amount), statusLabel, lenderName, date));
}

// ── Flow 5: Why This Amount ────────────────────────────────────────────────
//
// steps[0] = choice (1=farm, 2=livestock, 3=history, 4=full)

async function flowWhyAmount(
  phone: string,
  lang: Lang,
  steps: string[],
  farmer: Farmer | null,
): Promise<string> {
  const i18n = t(lang);

  if (steps.length === 0) return con(i18n.whyAmountMenu);

  const choice = steps[0];
  if (choice === '0') return con(i18n.mainMenu);

  // Get score (on-chain preferred)
  let score = farmer?.ai_score ?? 0;
  if (!score && farmer?.wallet_address) {
    const onChain = await getScoreFromChain(farmer.wallet_address).catch(() => null);
    if (onChain) {
      score = onChain.score;
      upsertFarmer(phone, { ai_score: score }).catch(console.error);
    }
  }

  // If no real score, derive from latest loan application data
  if (!score) {
    const loan = await getLatestLoan(phone);
    if (loan) {
      try {
        const notes = JSON.parse(loan.notes ?? '{}');
        score = estimateScore(notes.farmSizeChoice ?? '2', notes.livestockChoice ?? '2');
      } catch { score = 60; }
    }
  }

  if (!score) return end(i18n.noScore);

  const farmPts   = Math.round(score * 0.40);
  const lsPts     = Math.round(score * 0.37);
  const repayPts  = Math.min(score - farmPts - lsPts + 20, 100);
  const maxLoan   = score >= 80 ? 900_000 : score >= 60 ? 450_000 : score >= 40 ? 200_000 : 80_000;

  if (choice === '1') {
    const pts      = Math.min(Math.round(score * 0.40), 100);
    const nextAcres = pts < 68 ? '4-6 acres' : pts < 85 ? '7-15 acres' : '16+ acres';
    const nextPts   = pts < 68 ? 68 : pts < 85 ? 85 : 100;
    const label     = pts < 40 ? '1-3 acres' : pts < 68 ? '4-6 acres' : pts < 85 ? '7-15 acres' : '16+ acres';
    return end(i18n.whyFarm(label, pts, nextAcres, nextPts));
  }

  if (choice === '2') {
    const pts   = Math.min(Math.round(score * 0.37), 100);
    const label = pts < 55 ? 'None' : pts < 72 ? '1-5 animals' : pts < 85 ? '6-15 animals' : '16+ animals';
    return end(i18n.whyLivestock(label, pts));
  }

  if (choice === '3') {
    return end(i18n.whyHistory(repayPts));
  }

  // Full breakdown
  return end(i18n.whyFull(score, farmPts, lsPts, repayPts, fmt(maxLoan)));
}

// ── Flow 6: Improve Score ──────────────────────────────────────────────────
//
// steps[0] = choice (1=expand, 2=repay tips, 3=livestock, 4=records)

async function flowImproveScore(
  phone: string,
  lang: Lang,
  steps: string[],
  farmer: Farmer | null,
): Promise<string> {
  const i18n = t(lang);

  if (steps.length === 0) return con(i18n.improveMenu);

  const choice = steps[0];
  switch (choice) {
    case '0': return con(i18n.mainMenu);
    case '1': return end(i18n.improveExpand);
    case '2': return end(i18n.improveRepay);
    case '3': return end(i18n.improveLivestock);
    case '4': return end(i18n.improveRecords);
    default:  return con(i18n.improveMenu);
  }
}

// ── Flow 7: Help & FAQ ─────────────────────────────────────────────────────
//
// steps[0] = choice (1-6)

async function flowHelp(
  phone: string,
  lang: Lang,
  steps: string[],
): Promise<string> {
  const i18n = t(lang);

  if (steps.length === 0) return con(i18n.helpMenu);

  const choice = steps[0];
  switch (choice) {
    case '0': return con(i18n.mainMenu);
    case '1': return end(i18n.helpWhat);
    case '2': return end(i18n.helpDocs);
    case '3': return end(i18n.helpFees);
    case '4': return end(i18n.helpTimeline);
    case '5': return end(i18n.helpPrivacy);
    case '6': return end(i18n.helpContact);
    default:  return con(i18n.helpMenu);
  }
}
