export type Lang = 'en' | 'sw';

const LENDERS = [
  'KCB Bank Tanzania',
  'CRDB Bank',
  'NMB Bank',
  'Equity Bank Tanzania',
  'Akiba Commercial Bank',
];

// ── String tables ──────────────────────────────────────────────────────────

const strings = {
  en: {
    // ── Language / Welcome ─────────────────────────────────────────────────
    welcomeNew:
      'Welcome to VeriFarm\nAgricultural Lending\n\nSelect language:\n1. English\n2. Kiswahili',

    // ── Main Menu ──────────────────────────────────────────────────────────
    mainMenu:
      'VeriFarm - Main Menu\n\n1. Apply for Loan\n2. My Loans & Balance\n3. Repay Loan\n4. Check Status\n5. Why My Amount?\n6. Improve My Score\n7. Help & FAQ\n0. About VeriFarm',
    backOption: '0. Back',

    // ── Apply — Step 1: Farm Size ──────────────────────────────────────────
    applyFarmSize:
      'Apply - Step 1 of 5\nFarm size (acres):\n\n1. 1-3 acres\n2. 4-6 acres\n3. 7-15 acres\n4. 16+ acres\n\n0. Back to Menu',

    // ── Apply — Step 2: Crop Type ──────────────────────────────────────────
    applyCrop:
      'Apply - Step 2 of 5\nMain crop grown:\n\n1. Maize / Corn\n2. Rice\n3. Vegetables\n4. Cash crops (coffee, tea)\n5. Mixed / Other\n\n0. Back',

    // ── Apply — Step 3: Livestock ──────────────────────────────────────────
    applyLivestock:
      'Apply - Step 3 of 5\nNumber of livestock:\n\n1. None\n2. 1-5 animals\n3. 6-15 animals\n4. 16+ animals\n\n0. Back',

    // ── Apply — Step 4: Active Loan ────────────────────────────────────────
    applyActiveLoan:
      'Apply - Step 4 of 5\nDo you have an\nactive loan?\n\n1. Yes\n2. No\n\n0. Back',

    // ── Apply — Step 5: Choose Lender ─────────────────────────────────────
    applyLender: (list: string) =>
      `Apply - Step 5 of 5\nChoose your lender:\n\n${list}\n\n0. Back`,

    lenderList: () =>
      LENDERS.map((name, i) => `${i + 1}. ${name}`).join('\n'),

    // ── Apply — Confirm ────────────────────────────────────────────────────
    confirmLoan: (amount: string, lender: string) =>
      `Confirm Application\n\nEst. amount: TZS ${amount}\nLender: ${lender}\n\nFarm data will be\nsent for field\nverification.\n\n1. Confirm & Submit\n2. Cancel\n0. Back`,

    // ── Apply — Active Loan Block ──────────────────────────────────────────
    hasActiveLoan: (balance: string, ref: string) =>
      `Active Loan Found\nRef: ${ref}\nBalance: TZS ${balance}\n\nYou may apply again\nafter 50% repayment.\n\n1. Repay Loan\n2. Back to Menu`,

    loanSubmitted: (ref: string, lender: string) =>
      `Application received!\nRef: ${ref}\nLender: ${lender}\nSMS sent.\nReview: 24-48 hours.`,
    loanCancelled: 'Application cancelled.\nThank you for using VeriFarm.',

    // ── My Loans ───────────────────────────────────────────────────────────
    myLoansMenu:
      'My Loans & Balance\n\n1. Outstanding Balance\n2. Repayment Schedule\n3. Loan History\n4. Early Repayment\n\n0. Back to Menu',

    noLoans: 'No loan applications\nfound for your number.\nDial *123# to apply.',

    balanceScreen: (ref: string, principal: string, paid: string, balance: string, due: string) =>
      `Active Loan: ${ref}\n\nPrincipal: TZS ${principal}\nPaid:      TZS ${paid}\nBalance:   TZS ${balance}\n\nDue date: ${due}\n\n1. Repay Now\n0. Back`,

    scheduleScreen: (ref: string, rows: string) =>
      `Repayment Schedule\nLoan: ${ref}\n\n${rows}\n\n1. Repay Next\n0. Back`,

    historyScreen: (rows: string) =>
      `Loan History\n\n${rows}\n\n0. Back`,

    earlyRepayScreen: (ref: string, balance: string, savings: string, payNow: string) =>
      `Early Repayment\nLoan: ${ref}\n\nFull balance: TZS ${balance}\nInterest saved: TZS ${savings}\nPay now: TZS ${payNow}\n\n1. Pay TZS ${payNow} now\n2. Cancel\n0. Back`,

    // ── Check Status ───────────────────────────────────────────────────────
    loanStatus: (ref: string, amount: string, status: string, lender: string, date: string) =>
      `Loan Status\n\nRef: ${ref}\nAmount: TZS ${amount}\nLender: ${lender}\nStatus: ${status}\nApplied: ${date}`,

    // ── Repay Loan ─────────────────────────────────────────────────────────
    repayAmountMenu: (balance: string) =>
      `Repay Loan\nBalance: TZS ${balance}\n\nSelect amount:\n1. 50,000 TZS\n2. 100,000 TZS\n3. Full balance\n\n0. Back to Menu`,

    repayMethodMenu:
      'Payment Method\n\n1. M-Pesa\n2. Airtel Money\n3. Tigo Pesa\n4. HaloPesa\n\n0. Back',

    confirmRepay: (amount: string, method: string, ref: string) =>
      `Confirm Repayment\n\nAmount:  TZS ${amount}\nMethod:  ${method}\nRef:     ${ref}\n\nAn STK push will be\nsent to your phone.\n\n1. Confirm\n2. Cancel`,

    repayNoLoan:    'No active loan found.\nDial *123# to apply.',
    repayInitiated: (amount: string, method: string) =>
      `Repayment initiated!\nAmount: TZS ${amount}\nMethod: ${method}\n\nEnter your PIN when\nprompted on your phone.`,
    repayCancelled: 'Repayment cancelled.',

    // ── Why This Amount ────────────────────────────────────────────────────
    whyAmountMenu:
      'Why My Amount?\n\n1. Farm size score\n2. Livestock score\n3. Repayment history\n4. Full breakdown\n\n0. Back to Menu',

    noScore: 'Your profile is still\nbeing verified.\nCheck back in 24 hours.',

    whyFarm: (acres: string, pts: number, next: string, nextPts: number) =>
      `Farm Size Score\n\nYour farm: ${acres}\nYour score: ${pts}/100\n\nNext tier: ${next}\nNext score: ${nextPts}/100\n\nExpand your farm to\nunlock a higher limit.\n\n0. Back`,

    whyLivestock: (count: string, pts: number) =>
      `Livestock Score\n\nYour livestock: ${count}\nScore: ${pts}/100\n\nLivestock = collateral.\nMore animals = more\ntrust and higher loans.\n\n0. Back`,

    whyHistory: (score: number) =>
      `Repayment History\n\nYour score: ${score}/100\n\nOn-time repayment is\nthe fastest way to\nraise your loan limit.\n\nEvery payment counts.\n\n0. Back`,

    whyFull: (total: number, farmPts: number, lsPts: number, repayPts: number, maxLoan: string) =>
      `Full Score Breakdown\n\nFarm size:  ${farmPts}/100\nLivestock:  ${lsPts}/100\nRepayment:  ${repayPts}/100\n─────────────\nTotal:      ${total}/100\n\nMax loan: TZS ${maxLoan}\n\n0. Back`,

    // ── Improve Score ──────────────────────────────────────────────────────
    improveMenu:
      'Improve My Score\n\n1. Expand farm size\n2. Repayment tips\n3. Add more livestock\n4. Update farm records\n\n0. Back to Menu',

    improveExpand:
      'Expand Farm Size\n\nLarger farm = higher\nloan limit.\n\n1-3 acres:  40 pts\n4-6 acres:  68 pts\n7-15 acres: 85 pts\n16+ acres: 100 pts\n\nTalk to your local\nland office for help.\n\n0. Back',

    improveRepay:
      'Repayment Tips\n\nOn-time payment is\nthe fastest way to\ngrow your limit.\n\n- Set phone reminders\n- Pay before due date\n- Avoid partial pays\n- Early repay = bonus\n\n0. Back',

    improveLivestock:
      'Add Livestock\n\nLivestock is collateral\non the VeriFarm oracle.\n\n1-5 animals:  55 pts\n6-15 animals: 72 pts\n16+ animals: 100 pts\n\nMore animals = bigger\nloan limit.\n\n0. Back',

    improveRecords:
      'Update Farm Records\n\nRequest a field agent\nvisit to update:\n- Land title / lease\n- Livestock count\n- Crop type & season\n- Past harvest data\n\nCall: 0800-VERIFARM\n\n0. Back',

    // ── Help & FAQ ─────────────────────────────────────────────────────────
    helpMenu:
      'Help & FAQ\n\n1. What is VeriFarm?\n2. Documents needed\n3. Interest & fees\n4. Approval timeline\n5. Is my data safe?\n6. Contact support\n\n0. Back to Menu',

    helpWhat:
      'What is VeriFarm?\n\nVeriFarm uses Solana\nblockchain + field\nagents to verify farms\nso banks can lend with\nconfidence.\n\nNo paperwork. Fast.\nTransparent. Fair.\n\n0. Back',

    helpDocs:
      'Documents Needed\n\nRequired:\n- National ID / NIDA\n- Land title or lease\n- M-Pesa phone number\n\nOptional (boosts score):\n- Livestock records\n- Harvest receipts\n- Water source proof\n\n0. Back',

    helpFees:
      'Interest & Fees\n\nInterest: 6% per year\n(flat rate)\n\nProcessing fee: 0%\nEarly repayment: free\nLate fee: 2% per month\n\nExample: TZS 300,000\nfor 4 months:\nTotal: TZS 318,000\n\n0. Back',

    helpTimeline:
      'Approval Timeline\n\nDay 1: Apply via USSD\nDay 1-2: Field visit\n  Agent verifies farm\nDay 2: On blockchain\n  Solana record created\nDay 2-3: Bank decision\nDay 3: M-Pesa transfer\n\n0. Back',

    helpPrivacy:
      'Data Privacy\n\nYour personal ID is\nnot stored on-chain.\n\nOnly farm scores and\na cryptographic hash\ngo to the blockchain.\n\nBanks see scores, not\nyour private details.\n\nDelete: 0800-VERIFARM\n\n0. Back',

    helpContact:
      'Contact Support\n\nUSSD: *123#\nToll-free: 0800-VERIFARM\nSMS: 40400\nWhatsApp: +255 700 123 456\n\nMon-Fri: 8am-6pm\nSat: 9am-1pm\n\nsupport@verifarm.co.tz\n\n0. Back',

    // ── About ──────────────────────────────────────────────────────────────
    about:
      'About VeriFarm\n\nSolana Agricultural\nOracle for East Africa\n\nFounded: 2026\nMission: Make farm\nloans accessible to\nevery smallholder\nfarmer in Africa.\n\nPowered by Solana\n& World ID.\n\nverifarm.co.tz',

    // ── SMS ────────────────────────────────────────────────────────────────
    smsLoanReceived: (ref: string, amount: string, lender: string) =>
      `VeriFarm: Loan application of TZS ${amount} for ${lender} received. Ref: ${ref}. Field agent may visit. Review 24-48hrs. *123# for updates.`,
    smsLoanApproved: (ref: string, amount: string, lender: string) =>
      `VeriFarm: APPROVED! Your loan of TZS ${amount} from ${lender} (Ref: ${ref}) is approved. Funds disbursed to M-Pesa shortly. *123# for status.`,
    smsRepayInitiated: (amount: string, ref: string, method: string) =>
      `VeriFarm: Repayment of TZS ${amount} initiated via ${method} for loan ${ref}. Enter your PIN when prompted. *123# for status.`,

    // ── Errors ─────────────────────────────────────────────────────────────
    invalidOption: 'Invalid option.\nPlease try again.',
    error:         'Service temporarily unavailable.\nPlease try again shortly.',
  },

  sw: {
    welcomeNew:
      'Karibu VeriFarm\nMikopo ya Kilimo\n\nChagua lugha:\n1. English\n2. Kiswahili',

    mainMenu:
      'VeriFarm - Menyu Kuu\n\n1. Omba Mkopo\n2. Mikopo Yangu\n3. Lipa Mkopo\n4. Angalia Hali\n5. Kwa Nini Kiasi Hiki?\n6. Boresha Alama\n7. Msaada & Maswali\n0. Kuhusu VeriFarm',
    backOption: '0. Rudi',

    applyFarmSize:
      'Omba - Hatua 1 ya 5\nUkubwa wa shamba (eka):\n\n1. eka 1-3\n2. eka 4-6\n3. eka 7-15\n4. eka 16+\n\n0. Rudi Menyu',

    applyCrop:
      'Omba - Hatua 2 ya 5\nZao kuu unalolima:\n\n1. Mahindi\n2. Mchele\n3. Mboga\n4. Mazao ya biashara\n5. Mchanganyiko / Nyingine\n\n0. Rudi',

    applyLivestock:
      'Omba - Hatua 3 ya 5\nIdadi ya mifugo:\n\n1. Hakuna\n2. wanyama 1-5\n3. wanyama 6-15\n4. wanyama 16+\n\n0. Rudi',

    applyActiveLoan:
      'Omba - Hatua 4 ya 5\nUna mkopo unaoendelea\nkwa sasa?\n\n1. Ndiyo\n2. Hapana\n\n0. Rudi',

    applyLender: (list: string) =>
      `Omba - Hatua 5 ya 5\nChagua mkopeshaji:\n\n${list}\n\n0. Rudi`,

    lenderList: () =>
      LENDERS.map((name, i) => `${i + 1}. ${name}`).join('\n'),

    confirmLoan: (amount: string, lender: string) =>
      `Thibitisha Maombi\n\nKiasi cha tarajiwa: TZS ${amount}\nMkopeshaji: ${lender}\n\nData ya shamba\nitatumwa kwa ukaguzi.\n\n1. Thibitisha na Wasilisha\n2. Ghairi\n0. Rudi`,

    hasActiveLoan: (balance: string, ref: string) =>
      `Mkopo Unaoendelea\nKumb: ${ref}\nSalio: TZS ${balance}\n\nUnaweza kuomba tena\nbaada ya kulipa 50%.\n\n1. Lipa Mkopo\n2. Rudi Menyu`,

    loanSubmitted: (ref: string, lender: string) =>
      `Maombi yamepokelewa!\nKumb: ${ref}\nMkopeshaji: ${lender}\nSMS imetumwa.\nUkaguzi: saa 24-48.`,
    loanCancelled: 'Maombi yameghairiwa.\nAsante kwa kutumia VeriFarm.',

    myLoansMenu:
      'Mikopo Yangu\n\n1. Salio la Deni\n2. Ratiba ya Malipo\n3. Historia ya Mikopo\n4. Lipa Mapema\n\n0. Rudi Menyu',

    noLoans: 'Hakuna maombi ya mkopo\nyaliyopatikana.\nPiga *123# kuomba.',

    balanceScreen: (ref: string, principal: string, paid: string, balance: string, due: string) =>
      `Mkopo: ${ref}\n\nMkopo:    TZS ${principal}\nUmelipa: TZS ${paid}\nSalio:   TZS ${balance}\n\nTarehe: ${due}\n\n1. Lipa Sasa\n0. Rudi`,

    scheduleScreen: (ref: string, rows: string) =>
      `Ratiba ya Malipo\nMkopo: ${ref}\n\n${rows}\n\n1. Lipa Inayofuata\n0. Rudi`,

    historyScreen: (rows: string) =>
      `Historia ya Mikopo\n\n${rows}\n\n0. Rudi`,

    earlyRepayScreen: (ref: string, balance: string, savings: string, payNow: string) =>
      `Lipa Mapema\nMkopo: ${ref}\n\nSalio: TZS ${balance}\nUnaookoa: TZS ${savings}\nLipa sasa: TZS ${payNow}\n\n1. Lipa TZS ${payNow} sasa\n2. Ghairi\n0. Rudi`,

    loanStatus: (ref: string, amount: string, status: string, lender: string, date: string) =>
      `Hali ya Mkopo\n\nKumb: ${ref}\nKiasi: TZS ${amount}\nMkopeshaji: ${lender}\nHali: ${status}\nTarehe: ${date}`,

    repayAmountMenu: (balance: string) =>
      `Lipa Mkopo\nSalio: TZS ${balance}\n\nChagua kiasi:\n1. TZS 50,000\n2. TZS 100,000\n3. Salio lote\n\n0. Rudi Menyu`,

    repayMethodMenu:
      'Njia ya Malipo\n\n1. M-Pesa\n2. Airtel Money\n3. Tigo Pesa\n4. HaloPesa\n\n0. Rudi',

    confirmRepay: (amount: string, method: string, ref: string) =>
      `Thibitisha Malipo\n\nKiasi:  TZS ${amount}\nNjia:   ${method}\nKumb.:  ${ref}\n\nOmbi la STK litatumwa\nkwenye simu yako.\n\n1. Thibitisha\n2. Ghairi`,

    repayNoLoan:    'Hakuna mkopo unaotumika.\nPiga *123# kuomba mkopo.',
    repayInitiated: (amount: string, method: string) =>
      `Malipo yameanzishwa!\nKiasi: TZS ${amount}\nNjia: ${method}\n\nIngiza PIN yako\nunapoulizwa kwenye simu.`,
    repayCancelled: 'Malipo yameghairiwa.',

    whyAmountMenu:
      'Kwa Nini Kiasi Hiki?\n\n1. Alama za ukubwa shamba\n2. Alama za mifugo\n3. Historia ya malipo\n4. Muhtasari kamili\n\n0. Rudi Menyu',

    noScore: 'Wasifu wako unakaguliwa.\nAngalia tena baada ya masaa 24.',

    whyFarm: (acres: string, pts: number, next: string, nextPts: number) =>
      `Alama za Ukubwa Shamba\n\nShamba lako: ${acres}\nAlama yako: ${pts}/100\n\nKiwango kinachofuata: ${next}\nAlama: ${nextPts}/100\n\nPanua shamba lako\nkupata mkopo zaidi.\n\n0. Rudi`,

    whyLivestock: (count: string, pts: number) =>
      `Alama za Mifugo\n\nMifugo yako: ${count}\nAlama: ${pts}/100\n\nMifugo = dhamana.\nWanyama zaidi = imani\nzaidi na mkopo zaidi.\n\n0. Rudi`,

    whyHistory: (score: number) =>
      `Historia ya Malipo\n\nAlama yako: ${score}/100\n\nKulipa kwa wakati ni\nnjia ya haraka ya\nkuongeza mkopo wako.\n\nKila malipo inashikilia.\n\n0. Rudi`,

    whyFull: (total: number, farmPts: number, lsPts: number, repayPts: number, maxLoan: string) =>
      `Muhtasari Kamili\n\nUkubwa shamba: ${farmPts}/100\nMifugo:        ${lsPts}/100\nMalipo:        ${repayPts}/100\n─────────────\nJumla:         ${total}/100\n\nKikomo cha mkopo: TZS ${maxLoan}`,

    improveMenu:
      'Boresha Alama Zangu\n\n1. Panua shamba\n2. Vidokezo vya malipo\n3. Ongeza mifugo\n4. Sasisha rekodi za shamba\n\n0. Rudi Menyu',

    improveExpand:
      'Panua Shamba\n\nUkubwa mkubwa = mkopo\nmkubwa zaidi.\n\neka 1-3:  alama 40\neka 4-6:  alama 68\neka 7-15: alama 85\neka 16+: alama 100\n\nWasiliana na ofisi ya\nardhi ya eneo lako.\n\n0. Rudi',

    improveRepay:
      'Vidokezo vya Malipo\n\nLipa kwa wakati ni\nnjia ya haraka ya\nkuongeza mkopo wako.\n\n- Weka vikumbusha simu\n- Lipa kabla ya tarehe\n- Epuka malipo ya sehemu\n- Lipa mapema kwa bonasi\n\n0. Rudi',

    improveLivestock:
      'Ongeza Mifugo\n\nMifugo ni dhamana\nkwenye oracle ya VeriFarm.\n\nwanyama 1-5:  alama 55\nwanyama 6-15: alama 72\nwanyama 16+: alama 100\n\nWanyama zaidi = mkopo\nmkubwa zaidi.\n\n0. Rudi',

    improveRecords:
      'Sasisha Rekodi za Shamba\n\nOmba ziara ya afisa\nkusasisha:\n- Hati ya ardhi\n- Idadi ya mifugo\n- Aina ya zao na msimu\n- Data ya mavuno\n\nPiga: 0800-VERIFARM\n\n0. Rudi',

    helpMenu:
      'Msaada & Maswali\n\n1. VeriFarm ni nini?\n2. Hati zinazohitajika\n3. Riba na ada\n4. Ratiba ya idhini\n5. Data yangu iko salama?\n6. Wasiliana na msaada\n\n0. Rudi Menyu',

    helpWhat:
      'VeriFarm ni Nini?\n\nVeriFarm inatumia\nblockchain ya Solana\nna mawakala wa shamba\nkuthibitisha mashamba\nili benki zikopeshe\nkwa ujasiri.\n\nHaraka. Uwazi. Haki.\n\n0. Rudi',

    helpDocs:
      'Hati Zinazohitajika\n\nZinazohitajika:\n- Kitambulisho / NIDA\n- Hati ya ardhi / kukodisha\n- Nambari ya M-Pesa\n\nZa hiari (huongeza alama):\n- Rekodi za mifugo\n- Stakabadhi za mavuno\n- Ushahidi wa maji\n\n0. Rudi',

    helpFees:
      'Riba na Ada\n\nRiba: 6% kwa mwaka\n(kiwango gorofa)\n\nAda ya usindikaji: 0%\nKulipa mapema: bure\nAda ya kuchelewa: 2%/mwezi\n\nMfano: TZS 300,000\nkwa miezi 4:\nJumla: TZS 318,000\n\n0. Rudi',

    helpTimeline:
      'Ratiba ya Idhini\n\nSiku 1: Omba USSD\nSiku 1-2: Ziara shamba\n  Afisa anathibitisha\nSiku 2: Kwenye Solana\n  Data inawekwa\nSiku 2-3: Uamuzi Benki\nSiku 3: Uhamisho M-Pesa\n\n0. Rudi',

    helpPrivacy:
      'Faragha ya Data\n\nKitambulisho chako\nhakihifadhiwi kwenye\nblockchain.\n\nData ya shamba na hash\nya siri ya utambulisho\ntuu ndio inayokwenda.\n\nBenki zinaona alama,\nsi taarifa za siri.\n\nFuta: 0800-VERIFARM\n\n0. Rudi',

    helpContact:
      'Wasiliana na Msaada\n\nUSSD: *123#\nSimu: 0800-VERIFARM\nSMS: 40400\nWhatsApp: +255 700 123 456\n\nJuma-Ijumaa: 8am-6pm\nJumamosi: 9am-1pm\n\nsupport@verifarm.co.tz\n\n0. Rudi',

    about:
      'Kuhusu VeriFarm\n\nOracle ya Kilimo ya\nSolana kwa Afrika\nMashariki.\n\nIlianzishwa: 2026\nDhamira: Kufanya mikopo\nya shamba ipatikane\nkwa kila mkulima mdogo\nAfrika.\n\nverifarm.co.tz',

    smsLoanReceived: (ref: string, amount: string, lender: string) =>
      `VeriFarm: Ombi la mkopo TZS ${amount} kwa ${lender} limepokelewa. Kumb: ${ref}. Afisa anaweza kutembelea. Ukaguzi masaa 24-48. Piga *123# kwa maelezo.`,
    smsLoanApproved: (ref: string, amount: string, lender: string) =>
      `VeriFarm: IMEIDHINISHWA! Mkopo wa TZS ${amount} kutoka ${lender} (Kumb: ${ref}) umeidhinishwa. Fedha zitatumwa M-Pesa hivi karibuni.`,
    smsRepayInitiated: (amount: string, ref: string, method: string) =>
      `VeriFarm: Malipo ya TZS ${amount} kwa mkopo ${ref} yameanzishwa kupitia ${method}. Ingiza PIN yako unapoulizwa.`,

    invalidOption: 'Chaguo batili.\nTafadhali jaribu tena.',
    error:         'Huduma haipatikani sasa.\nTafadhali jaribu baadaye.',
  },
};

export type Strings = typeof strings.en;

export function t(lang: Lang): Strings {
  return (strings[lang] ?? strings.en) as unknown as Strings;
}

export { LENDERS };

// Status labels for both languages
export const STATUS_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    pending:   'Under Review',
    approved:  'Approved',
    active:    'Disbursed',
    repaid:    'Fully Repaid',
    defaulted: 'Defaulted',
    rejected:  'Not Approved',
  },
  sw: {
    pending:   'Inakaguliwa',
    approved:  'Imeidhinishwa',
    active:    'Imetolewa',
    repaid:    'Imelipwa Yote',
    defaulted: 'Imekosekana',
    rejected:  'Haikuidhinishwa',
  },
};
