import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Schema ─────────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS farmers (
      id                 SERIAL PRIMARY KEY,
      phone_number       VARCHAR(20)  UNIQUE NOT NULL,
      full_name          VARCHAR(100),
      wallet_address     VARCHAR(64),
      preferred_language CHAR(2),
      ai_score           INTEGER     DEFAULT 0,
      loan_stage         INTEGER     DEFAULT 1,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS loan_applications (
      id             SERIAL PRIMARY KEY,
      phone_number   VARCHAR(20)  NOT NULL,
      amount         BIGINT       NOT NULL,
      currency       CHAR(3)      DEFAULT 'TZS',
      status         VARCHAR(20)  DEFAULT 'pending',
      reference      VARCHAR(30)  UNIQUE NOT NULL,
      wallet_address VARCHAR(64),
      tx_signature   VARCHAR(100),
      notes          TEXT,
      created_at     TIMESTAMPTZ  DEFAULT NOW(),
      updated_at     TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_loan_phone ON loan_applications(phone_number);

    CREATE TABLE IF NOT EXISTS repayments (
      id             SERIAL PRIMARY KEY,
      phone_number   VARCHAR(20)  NOT NULL,
      loan_ref       VARCHAR(30),
      amount         BIGINT       NOT NULL,
      currency       CHAR(3)      DEFAULT 'TZS',
      status         VARCHAR(20)  DEFAULT 'pending',
      transaction_id VARCHAR(100),
      tx_signature   VARCHAR(100),
      created_at     TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_repayment_phone ON repayments(phone_number);

    CREATE TABLE IF NOT EXISTS sessions (
      session_id    VARCHAR(100) PRIMARY KEY,
      phone_number  VARCHAR(20)  NOT NULL,
      had_lang_step BOOLEAN      DEFAULT FALSE,
      created_at    TIMESTAMPTZ  DEFAULT NOW()
    );
  `);
  console.log('Database ready');
}

export async function getSessionLangStep(sessionId: string): Promise<boolean | null> {
  const { rows } = await pool.query(
    'SELECT had_lang_step FROM sessions WHERE session_id = $1',
    [sessionId]
  );
  if (rows.length === 0) return null;
  return rows[0].had_lang_step as boolean;
}

export async function createSession(sessionId: string, phone: string, hadLangStep: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO sessions (session_id, phone_number, had_lang_step)
     VALUES ($1, $2, $3) ON CONFLICT (session_id) DO NOTHING`,
    [sessionId, normalisePhone(phone), hadLangStep]
  );
}

export interface Repayment {
  id: number;
  phone_number: string;
  loan_ref: string | null;
  amount: number;
  status: string;
  transaction_id: string | null;
  created_at: Date;
}

export async function createRepayment(
  phone: string,
  amount: number,
  loanRef: string | null,
  transactionId: string | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO repayments (phone_number, amount, loan_ref, transaction_id)
     VALUES ($1, $2, $3, $4)`,
    [normalisePhone(phone), amount, loanRef, transactionId],
  );
}

export async function getRepaymentsByPhone(phone: string): Promise<Repayment[]> {
  const { rows } = await pool.query<Repayment>(
    `SELECT * FROM repayments WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 5`,
    [normalisePhone(phone)],
  );
  return rows;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Farmer {
  id: number;
  phone_number: string;
  full_name: string | null;
  wallet_address: string | null;
  preferred_language: string | null;
  ai_score: number;
  loan_stage: number;
}

export interface LoanApplication {
  id: number;
  phone_number: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  wallet_address: string | null;
  tx_signature: string | null;
  created_at: Date;
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getFarmerByPhone(phone: string): Promise<Farmer | null> {
  const { rows } = await pool.query<Farmer>(
    'SELECT * FROM farmers WHERE phone_number = $1',
    [normalisePhone(phone)]
  );
  return rows[0] ?? null;
}

export async function upsertFarmer(
  phone: string,
  updates: Partial<Omit<Farmer, 'id' | 'phone_number'>>
): Promise<Farmer> {
  const p = normalisePhone(phone);

  // Ensure row exists
  await pool.query(
    `INSERT INTO farmers (phone_number) VALUES ($1) ON CONFLICT (phone_number) DO NOTHING`,
    [p]
  );

  if (Object.keys(updates).length > 0) {
    const cols = Object.keys(updates);
    const vals = Object.values(updates);
    const setClause = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await pool.query(
      `UPDATE farmers SET ${setClause}, updated_at = NOW() WHERE phone_number = $1`,
      [p, ...vals]
    );
  }

  return (await getFarmerByPhone(p))!;
}

export async function createLoanApplication(
  phone: string,
  amount: number,
  walletAddress?: string
): Promise<string> {
  const ref = `VF-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  await pool.query(
    `INSERT INTO loan_applications (phone_number, amount, reference, wallet_address)
     VALUES ($1, $2, $3, $4)`,
    [normalisePhone(phone), amount, ref, walletAddress ?? null]
  );
  return ref;
}

export async function getLatestLoan(phone: string): Promise<LoanApplication | null> {
  const { rows } = await pool.query<LoanApplication>(
    `SELECT * FROM loan_applications
     WHERE phone_number = $1
     ORDER BY created_at DESC LIMIT 1`,
    [normalisePhone(phone)]
  );
  return rows[0] ?? null;
}

export async function getAllLoans(phone: string): Promise<LoanApplication[]> {
  const { rows } = await pool.query<LoanApplication>(
    `SELECT * FROM loan_applications
     WHERE phone_number = $1
     ORDER BY created_at DESC LIMIT 5`,
    [normalisePhone(phone)]
  );
  return rows;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalisePhone(phone: string): string {
  // Ensure E.164 — strip spaces, ensure leading +
  const stripped = phone.replace(/\s+/g, '');
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
}
