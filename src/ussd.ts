import { Request, Response } from 'express';
import {
  getFarmerByPhone,
  upsertFarmer,
  createLoanApplication,
  createRepayment,
  getLatestLoan,
  getSessionLangStep,
  createSession,
  Farmer,
} from './db';
import { t, Lang, STATUS_LABELS } from './i18n';
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
    console.log(`[USSD] session=${sessionId} phone=${phoneNumber} text="${text}" → ${response.slice(0, 60)}`);
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

  // Every session starts with a language selection step
  const hadLangStep = await getSessionLangStep(sessionId);
  if (hadLangStep === null) {
    await createSession(sessionId, phone, true);
  }

  // ── Language selection on every fresh dial ────────────────────────────
  if (parts.length === 0) {
    return con(t('en').welcomeNew);
  }

  if (parts.length === 1) {
    const langChoice: Lang = parts[0] === '2' ? 'sw' : 'en';
    await upsertFarmer(phone, { preferred_language: langChoice });
    return con(t(langChoice).mainMenu);
  }

  // ── Determine language from this session's first choice ───────────────
  const lang: Lang = parts[0] === '2' ? 'sw' : 'en';

  // Strip the language selection step for menu routing
  const menuParts = parts.slice(1);

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
    case '2': return flowCheckStatus(phone, lang, farmer);
    case '3': return flowWhyAmount(phone, lang, farmer);
    case '4': return flowImproveScore(phone, lang, farmer);
    case '5': return flowRepayLoan(phone, lang, rest, farmer);
    default:  return end(t(lang).invalidOption);
  }
}

// ── Flow 1: Apply for Loan ─────────────────────────────────────────────────
//
//  steps=[]                       → Step 1: ask farm size (1/2/3)
//  steps=[farmSize]               → Step 2: ask livestock count (1/2/3)
//  steps=[farmSize, livestock]    → Step 3: ask active loan (1/2)
//  steps=[farmSize, ls, loan]     → Show confirm with calculated amount
//  steps=[farmSize, ls, loan, 1]  → Confirmed → save + SMS
//  steps=[farmSize, ls, loan, 2]  → Cancelled
//  Any step with '0'              → Back to main menu

// Loan amount lookup: [farmSizeChoice][livestockChoice]
const LOAN_TABLE: Record<string, Record<string, number>> = {
  '1': { '1': 100_000, '2': 150_000, '3': 200_000 }, // 1-3 acres
  '2': { '1': 200_000, '2': 300_000, '3': 400_000 }, // 4-6 acres
  '3': { '1': 400_000, '2': 600_000, '3': 800_000 }, // 7+ acres
};

function calcLoanAmount(farmSize: string, livestock: string, activeLoan: string): number {
  const base = LOAN_TABLE[farmSize]?.[livestock] ?? 100_000;
  // Active loan reduces eligible amount by 30%
  return activeLoan === '1' ? Math.round(base * 0.7) : base;
}

async function flowApplyLoan(
  phone: string,
  lang: Lang,
  steps: string[],
  farmer: Farmer | null,
): Promise<string> {
  const i18n = t(lang);

  // Step 1: ask farm size
  if (steps.length === 0) return con(i18n.applyFarmSize);

  const farmSize = steps[0];
  if (farmSize === '0') return con(i18n.mainMenu);
  if (!['1', '2', '3'].includes(farmSize)) return con(i18n.applyFarmSize);

  // Step 2: ask livestock
  if (steps.length === 1) return con(i18n.applyLivestock);

  const livestock = steps[1];
  if (livestock === '0') return con(i18n.mainMenu);
  if (!['1', '2', '3'].includes(livestock)) return con(i18n.applyLivestock);

  // Step 3: ask active loan
  if (steps.length === 2) return con(i18n.applyActiveLoan);

  const activeLoan = steps[2];
  if (activeLoan === '0') return con(i18n.mainMenu);
  if (!['1', '2'].includes(activeLoan)) return con(i18n.applyActiveLoan);

  // Show confirmation with calculated amount
  const amount    = calcLoanAmount(farmSize, livestock, activeLoan);
  const formatted = fmt(amount);

  if (steps.length === 3) return con(i18n.confirmLoan(formatted));

  const confirm = steps[3];
  if (confirm === '0') return con(i18n.mainMenu);
  if (confirm === '2') return end(i18n.loanCancelled);
  if (confirm !== '1') return con(i18n.confirmLoan(formatted));

  // ── Confirmed: save to DB ──────────────────────────────────────────────
  const wallet = farmer?.wallet_address ?? undefined;
  const ref    = await createLoanApplication(phone, amount, wallet);

  broadcast({ type: 'loan_application', phone: maskPhone(phone), amount, reference: ref, lang, ts: new Date().toISOString() });
  sendSms(phone, i18n.smsLoanReceived(ref, formatted)).catch(console.error);

  return end(i18n.loanSubmitted(ref));
}

// ── Flow 2: Check Loan Status ──────────────────────────────────────────────

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
      const amountTzs   = fmt(Math.round(onChain.principalLamports / 1_000)); // lamports → TZS (demo conversion)
      return end(i18n.loanStatus('on-chain', amountTzs, statusLabel, 'Devnet'));
    }
  }

  // Fall back to DB
  const loan = await getLatestLoan(phone);
  if (!loan) return end(i18n.noLoans);

  const statusLabel = STATUS_LABELS[lang][loan.status] ?? loan.status;
  const date = new Date(loan.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return end(i18n.loanStatus(loan.reference, fmt(loan.amount), statusLabel, date));
}

// ── Flow 3: Why This Amount? ───────────────────────────────────────────────

async function flowWhyAmount(
  phone: string,
  lang: Lang,
  farmer: Farmer | null,
): Promise<string> {
  const i18n = t(lang);

  // Try on-chain score
  let score = farmer?.ai_score ?? 0;
  if (!score && farmer?.wallet_address) {
    const onChain = await getScoreFromChain(farmer.wallet_address).catch(() => null);
    if (onChain) {
      score = onChain.score;
      // Cache score back to DB
      upsertFarmer(phone, { ai_score: score }).catch(console.error);
    }
  }

  if (!score) return end(i18n.noScore);

  // Derive factor breakdown matching frontend AIRiskAssessment logic
  const landPts      =  Math.round(score * 0.32);
  const livestockPts =  Math.round(score * 0.37);
  const weatherPts   = -Math.round(score * 0.09);
  const maxLoan      = score >= 80 ? 500_000 : score >= 55 ? 200_000 : 50_000;

  return end(i18n.whyAmount(score, landPts, livestockPts, weatherPts, fmt(maxLoan)));
}

// ── Flow 5: Repay Loan ─────────────────────────────────────────────────────
//
//  steps=[]            → show prompt to enter repayment amount
//  steps=[amount]      → confirm with loan ref
//  steps=[amount, 1]   → trigger M-Pesa STK push + SMS
//  steps=[amount, 2]   → cancelled

async function flowRepayLoan(
  phone: string,
  lang:  Lang,
  steps: string[],
  farmer: Farmer | null,
): Promise<string> {
  const i18n = t(lang);

  // Find the active loan to reference
  const loan = await getLatestLoan(phone);
  if (!loan) return end(i18n.repayNoLoan);

  if (steps.length === 0) return con(i18n.repayMenu);

  const rawAmount = steps[0];
  if (rawAmount === '0') return con(i18n.mainMenu);

  const amount = parseInt(rawAmount.replace(/[^0-9]/g, ''), 10);
  if (isNaN(amount) || amount < 1_000) return con(i18n.repayMenu);

  const formatted = fmt(amount);

  if (steps.length === 1) return con(i18n.confirmRepay(formatted, loan.reference));

  if (steps[1] === '2') return end(i18n.repayCancelled);
  if (steps[1] !== '1') return con(i18n.confirmRepay(formatted, loan.reference));

  // ── Confirmed: trigger STK push ────────────────────────────────────────
  const checkout = await triggerMobileCheckout(phone, amount, loan.reference);
  await createRepayment(phone, amount, loan.reference, checkout.transactionId);

  // Broadcast live event
  broadcast({ type: 'repayment', phone: maskPhone(phone), amount, reference: loan.reference, lang, ts: new Date().toISOString() });

  // Non-blocking SMS
  sendSms(phone, i18n.smsRepayInitiated(formatted, loan.reference)).catch(console.error);

  return end(i18n.repayInitiated(formatted));
}

// ── Flow 4: Improve My Score ───────────────────────────────────────────────

async function flowImproveScore(
  phone: string,
  lang: Lang,
  farmer: Farmer | null,
): Promise<string> {
  const i18n = t(lang);

  let score = farmer?.ai_score ?? 0;
  if (!score && farmer?.wallet_address) {
    const onChain = await getScoreFromChain(farmer.wallet_address).catch(() => null);
    if (onChain) score = onChain.score;
  }

  if (!score) return end(i18n.noScore);

  return end(i18n.improveScore(score));
}
