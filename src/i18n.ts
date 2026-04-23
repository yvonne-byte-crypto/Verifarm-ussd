export type Lang = 'en' | 'sw';

// ── String tables ──────────────────────────────────────────────────────────

const strings = {
  en: {
    // Menus
    welcomeNew:   'Welcome to VeriFarm\nAgricultural Lending\n\nSelect language:\n1. English\n2. Kiswahili',
    mainMenu:     'VeriFarm\n1. Apply for Loan\n2. Check Loan Status\n3. Why This Amount?\n4. Improve My Score\n5. Repay Loan',
    backOption:   '0. Back',

    // Apply for loan — step 1
    applyFarmSize:
      'Step 1 of 3\nEnter farm size:\n\n1. 1-3 acres\n2. 4-6 acres\n3. 7+ acres\n\n0. Back',
    // Apply for loan — step 2
    applyLivestock:
      'Step 2 of 3\nNumber of livestock:\n\n1. 0-5 animals\n2. 6-15 animals\n3. 16+ animals\n\n0. Back',
    // Apply for loan — step 3
    applyActiveLoan:
      'Step 3 of 3\nDo you have an\nactive loan?\n\n1. Yes\n2. No\n\n0. Back',
    confirmLoan: (amount: string) =>
      `Confirm application:\nEst. amount: TZS ${amount}\n\nDetails sent for\nfield verification.\n\n1. Confirm\n2. Cancel\n0. Back`,
    loanSubmitted: (ref: string) =>
      `Application received!\nRef: ${ref}\nSMS sent to your number.\nReview: 24-48 hours.`,
    loanCancelled: 'Cancelled.\nThank you for using VeriFarm.',
    invalidOption2: 'Invalid choice.\nPlease select 1, 2 or 3.',

    // Check status
    noLoans:    'No loan applications found.\nDial again to apply.',
    loanStatus: (ref: string, amount: string, status: string, date: string) =>
      `Loan: ${ref}\nAmount: TZS ${amount}\nStatus: ${status}\nDate: ${date}`,

    // Why this amount
    noScore:   'Profile under verification.\nCheck back in 24 hours.',
    whyAmount: (score: number, land: number, livestock: number, weather: number, max: string) =>
      `AI Score: ${score}/100\n\n+Land & crops: +${land}pts\n+Livestock health: +${livestock}pts\n-Rainfall index: ${weather}pts\n\nMax eligible: TZS ${max}`,

    // Improve score
    improveScore: (score: number) =>
      `Score: ${score}/100\n\nTips to improve:\n1. Register more livestock\n2. Submit land documents\n3. Record crop sales\n4. Repay loans on time`,

    // Repay loan
    repayMenu:       'Repay Loan\nOutstanding balance shown\nafter confirmation.\n\nEnter repayment amount (TZS):\n\n0. Back',
    repayNoLoan:     'No active loan found.\nDial again to apply for a loan.',
    confirmRepay:    (amount: string, ref: string) =>
      `Confirm repayment:\nAmount: TZS ${amount}\nLoan ref: ${ref}\n\n1. Confirm (M-Pesa push)\n2. Cancel`,
    repayInitiated:  (amount: string) =>
      `Repayment of TZS ${amount} initiated.\nCheck your phone for M-Pesa PIN prompt.\nRef will appear in your SMS.`,
    repayCancelled:  'Repayment cancelled.',

    // SMS messages
    smsLoanReceived: (ref: string, amount: string) =>
      `VeriFarm: Loan application of TZS ${amount} received. Ref: ${ref}. We will review within 24-48hrs. Dial *384*7# for updates.`,
    smsLoanApproved: (ref: string, amount: string) =>
      `VeriFarm: APPROVED! Your loan of TZS ${amount} (Ref: ${ref}) has been approved. Funds will be disbursed to your M-Pesa shortly.`,
    smsRepayInitiated: (amount: string, ref: string) =>
      `VeriFarm: Repayment of TZS ${amount} initiated for loan ${ref}. Enter your M-Pesa PIN to complete. Dial *384*7# for status.`,

    // Errors
    invalidOption: 'Invalid option.\nPlease try again.',
    error:         'Service temporarily unavailable.\nPlease try again shortly.',
  },

  sw: {
    welcomeNew:   'Karibu VeriFarm\nMikopo ya Kilimo\n\nChagua lugha:\n1. English\n2. Kiswahili',
    mainMenu:     'VeriFarm\n1. Omba Mkopo\n2. Hali ya Mkopo\n3. Kwa Nini Kiasi Hiki?\n4. Boresha Alama\n5. Lipa Mkopo',
    backOption:   '0. Rudi',

    applyFarmSize:
      'Hatua 1 ya 3\nUkubwa wa shamba:\n\n1. eka 1-3\n2. eka 4-6\n3. eka 7+\n\n0. Rudi',
    applyLivestock:
      'Hatua 2 ya 3\nIdadi ya mifugo:\n\n1. wanyama 0-5\n2. wanyama 6-15\n3. wanyama 16+\n\n0. Rudi',
    applyActiveLoan:
      'Hatua 3 ya 3\nUna mkopo unaoendelea\nkwa sasa?\n\n1. Ndiyo\n2. Hapana\n\n0. Rudi',
    confirmLoan: (amount: string) =>
      `Thibitisha ombi:\nKiasi cha tarajiwa: TZS ${amount}\n\nTaarifa zako zitatumwa\nkwa uthibitisho.\n\n1. Thibitisha\n2. Ghairi\n0. Rudi`,
    loanSubmitted: (ref: string) =>
      `Ombi limepokelewa!\nKumb: ${ref}\nSMS imetumwa.\nUkaguzi: masaa 24-48.`,
    loanCancelled: 'Ombi limeghairiwa.\nAsante kwa kutumia VeriFarm.',
    invalidOption2: 'Chaguo batili.\nTafadhali chagua 1, 2 au 3.',

    noLoans:    'Hakuna maombi ya mkopo.\nPiga simu tena kuomba.',
    loanStatus: (ref: string, amount: string, status: string, date: string) =>
      `Mkopo: ${ref}\nKiasi: TZS ${amount}\nHali: ${status}\nTarehe: ${date}`,

    noScore:   'Wasifu wako unakaguliwa.\nAngalia tena baada ya masaa 24.',
    whyAmount: (score: number, land: number, livestock: number, weather: number, max: string) =>
      `Alama: ${score}/100\n\n+Ardhi na mazao: +${land}pt\n+Afya ya mifugo: +${livestock}pt\n-Mvua ya eneo: ${weather}pt\n\nKiwango cha juu: TZS ${max}`,

    improveScore: (score: number) =>
      `Alama yako: ${score}/100\n\nVidokezo:\n1. Sajili mifugo zaidi\n2. Tuma hati za ardhi\n3. Rekodi mauzo ya mazao\n4. Lipa mkopo kwa wakati`,

    repayMenu:       'Lipa Mkopo\nIngiza kiasi cha malipo (TZS):\n\n0. Rudi',
    repayNoLoan:     'Hakuna mkopo unaotumika.\nPiga simu tena kuomba mkopo.',
    confirmRepay:    (amount: string, ref: string) =>
      `Thibitisha malipo:\nKiasi: TZS ${amount}\nKumb: ${ref}\n\n1. Thibitisha (M-Pesa)\n2. Ghairi`,
    repayInitiated:  (amount: string) =>
      `Malipo ya TZS ${amount} yameanzishwa.\nAngalia simu yako kwa ombi la PIN ya M-Pesa.`,
    repayCancelled:  'Malipo yameghairiwa.',

    smsLoanReceived: (ref: string, amount: string) =>
      `VeriFarm: Ombi la mkopo TZS ${amount} limepokelewa. Kumb: ${ref}. Tunakagua ndani ya masaa 24-48. Piga *384*7# kwa maelezo.`,
    smsLoanApproved: (ref: string, amount: string) =>
      `VeriFarm: IMEIDHINISHWA! Mkopo wako wa TZS ${amount} (Kumb: ${ref}) umeidhinishwa. Fedha zitatumwa M-Pesa hivi karibuni.`,
    smsRepayInitiated: (amount: string, ref: string) =>
      `VeriFarm: Malipo ya TZS ${amount} kwa mkopo ${ref} yameanzishwa. Ingiza PIN yako ya M-Pesa kukamilisha.`,

    invalidOption: 'Chaguo batili.\nTafadhali jaribu tena.',
    error:         'Huduma haipatikani sasa.\nTafadhali jaribu baadaye.',
  },
};

export type Strings = {
  welcomeNew:       string;
  mainMenu:         string;
  backOption:       string;
  applyFarmSize:    string;
  applyLivestock:   string;
  applyActiveLoan:  string;
  confirmLoan:      (amount: string) => string;
  loanSubmitted:    (ref: string) => string;
  loanCancelled:    string;
  invalidOption2:   string;
  noLoans:       string;
  loanStatus:    (ref: string, amount: string, status: string, date: string) => string;
  noScore:       string;
  whyAmount:     (score: number, land: number, livestock: number, weather: number, max: string) => string;
  improveScore:  (score: number) => string;
  repayMenu:       string;
  repayNoLoan:     string;
  confirmRepay:    (amount: string, ref: string) => string;
  repayInitiated:  (amount: string) => string;
  repayCancelled:  string;
  smsLoanReceived:   (ref: string, amount: string) => string;
  smsLoanApproved:   (ref: string, amount: string) => string;
  smsRepayInitiated: (amount: string, ref: string) => string;
  invalidOption: string;
  error:         string;
};

export function t(lang: Lang): Strings {
  return strings[lang] ?? strings.en;
}

// Status labels for both languages
export const STATUS_LABELS: Record<Lang, Record<string, string>> = {
  en: { pending: 'Under Review', approved: 'Approved', active: 'Disbursed', repaid: 'Repaid', defaulted: 'Defaulted' },
  sw: { pending: 'Inakaguliwa', approved: 'Imeidhinishwa', active: 'Imetolewa', repaid: 'Imelipwa', defaulted: 'Imekosekana' },
};
