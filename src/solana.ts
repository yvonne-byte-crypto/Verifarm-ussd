import { createHash } from 'crypto';
import {
  Connection, PublicKey, Keypair, Transaction,
  TransactionInstruction, SystemProgram, sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

const PROGRAM_ID = new PublicKey('9teMVR4r2AB9T5bB4YgXJ38G6mMbxTF6bFm8UYizqx8N');
const RPC_URL    = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

const connection = new Connection(RPC_URL, 'confirmed');

// Byte layout mirrors the Anchor struct offsets used in the test suite
// Loan: disc(8) + farmer(32) + token_mint(32) + principal(8) + outstanding(8) + interest_bps(2) + term_days(2) + status(1)
const LOAN_PRINCIPAL_OFFSET = 8 + 32 + 32;           // 72 — u64 LE
const LOAN_STATUS_OFFSET    = 8 + 32 + 32 + 8 + 8 + 2 + 2; // 92 — u8
const LOAN_DUE_OFFSET       = 8 + 32 + 32 + 8 + 8 + 2 + 2 + 1 + 8; // after disbursed_at

const LOAN_STATUS_MAP: Record<number, string> = {
  0: 'pending',
  1: 'approved',
  2: 'active',
  3: 'repaid',
  4: 'defaulted',
  5: 'liquidated',
};

// Farmer: disc(8) + authority(32) + name(36) + land_acres(4) + cattle_count(4) + phone_hash(32) + status(1)
// Risk score stored in RiskScore PDA not Farmer account
const RISK_SCORE_DISC = Buffer.from([/* sha256("account:RiskScore")[0..8] */ 0x4e, 0x8d, 0x6a, 0x1f, 0x9b, 0x3c, 0x72, 0xd5]);

function farmerPda(authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('farmer'), authority.toBuffer()],
    PROGRAM_ID
  )[0];
}

function loanPda(farmer: PublicKey, index: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('loan'), farmer.toBuffer(), Buffer.from(new Uint16Array([index]).buffer)],
    PROGRAM_ID
  )[0];
}

function riskScorePda(farmer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('risk_score'), farmer.toBuffer()],
    PROGRAM_ID
  )[0];
}

function oracleEntryPda(oracle: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('oracle_entry'), oracle.toBuffer()],
    PROGRAM_ID
  )[0];
}

// Instruction discriminator = sha256("global:submit_risk_score")[0..8]
const SUBMIT_SCORE_DISC = createHash('sha256')
  .update('global:submit_risk_score')
  .digest()
  .slice(0, 8);

export interface OnChainLoan {
  status: string;
  principalLamports: number;
}

export interface OnChainScore {
  score: number;
}

/**
 * Fetch the most recent loan status from the Solana program.
 * Returns null if the wallet has no loans or the RPC call fails.
 */
export async function getLoanStatusFromChain(
  walletAddress: string,
  loanIndex = 0
): Promise<OnChainLoan | null> {
  try {
    const authority  = new PublicKey(walletAddress);
    const farmer     = farmerPda(authority);
    const loan       = loanPda(farmer, loanIndex);

    const info = await connection.getAccountInfo(loan);
    if (!info || info.data.length <= LOAN_STATUS_OFFSET) return null;

    const data   = Buffer.from(info.data);
    const status = LOAN_STATUS_MAP[data[LOAN_STATUS_OFFSET]] ?? 'unknown';

    let principalLamports = 0;
    if (data.length > LOAN_PRINCIPAL_OFFSET + 8) {
      const lo = data.readUInt32LE(LOAN_PRINCIPAL_OFFSET);
      const hi = data.readUInt32LE(LOAN_PRINCIPAL_OFFSET + 4);
      principalLamports = hi * 0x100000000 + lo;
    }

    return { status, principalLamports };
  } catch {
    return null;
  }
}

/**
 * Fetch farmer's AI risk score from the RiskScore PDA.
 * Returns null if account doesn't exist or RPC fails.
 */
export async function getScoreFromChain(walletAddress: string): Promise<OnChainScore | null> {
  try {
    const authority = new PublicKey(walletAddress);
    const farmer    = farmerPda(authority);
    const scoreAcct = riskScorePda(farmer);

    const info = await connection.getAccountInfo(scoreAcct);
    if (!info || info.data.length < 10) return null;

    // RiskScore: disc(8) + farmer(32) + score(1) + ...
    const score = info.data[8 + 32];
    return { score };
  } catch {
    return null;
  }
}

/**
 * Submit an AI risk score on-chain via the oracle keypair.
 * Requires ORACLE_KEYPAIR_BASE58 env var (base58-encoded secret key).
 * Silently returns null if the keypair is not configured.
 */
export async function submitRiskScoreOnChain(
  farmerWallet: string,
  score: number,
): Promise<string | null> {
  const raw = process.env.ORACLE_KEYPAIR_BASE58;
  if (!raw) return null;

  try {
    const oracleKeypair   = Keypair.fromSecretKey(bs58.decode(raw));
    const authority       = new PublicKey(farmerWallet);
    const farmer          = farmerPda(authority);
    const riskScore       = riskScorePda(farmer);
    const oracleEntry     = oracleEntryPda(oracleKeypair.publicKey);

    // Instruction data: discriminator(8) + score(1 byte u8)
    const data = Buffer.concat([SUBMIT_SCORE_DISC, Buffer.from([score & 0xff])]);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: oracleKeypair.publicKey, isSigner: true,  isWritable: true  }, // payer
        { pubkey: oracleEntry,             isSigner: false, isWritable: false },
        { pubkey: farmer,                  isSigner: false, isWritable: false },
        { pubkey: riskScore,               isSigner: false, isWritable: true  },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx  = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [oracleKeypair]);
    return sig;
  } catch (err) {
    console.error('[Solana] submitRiskScore failed:', err);
    return null;
  }
}
