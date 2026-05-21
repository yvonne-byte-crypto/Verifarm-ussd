import { createHash } from 'crypto';
import {
  Connection, PublicKey, Keypair, Transaction,
  TransactionInstruction, SystemProgram, sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

const PROGRAM_ID = new PublicKey('9teMVR4r2AB9T5bB4YgXJ38G6mMbxTF6bFm8UYizqx8N');
const RPC_URL    = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

export const connection = new Connection(RPC_URL, 'confirmed');

// Default GPS: approximate centre of Tanzania (0,0 alternative causes on-chain
// issues; Tanzania centre is a safe fallback until agent does field verification)
const TANZANIA_LAT_MICRO = -6_369_028n;  // -6.369028 × 1_000_000
const TANZANIA_LNG_MICRO = 34_888_822n;  //  34.888822 × 1_000_000

// ── PDA derivations ────────────────────────────────────────────────────────

export function farmerPda(authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('farmer'), authority.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function loanPda(farmer: PublicKey, index: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('loan'), farmer.toBuffer(), Buffer.from(new Uint16Array([index]).buffer)],
    PROGRAM_ID,
  )[0];
}

export function riskScorePda(farmer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('risk_score'), farmer.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function oracleEntryPda(oracle: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('oracle_entry'), oracle.toBuffer()],
    PROGRAM_ID,
  )[0];
}

// ── Borsh helpers ──────────────────────────────────────────────────────────

function borshString(s: string): Buffer {
  const bytes = Buffer.from(s, 'utf8');
  const len   = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

function borshI64(n: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(n, 0);
  return buf;
}

// ── Instruction discriminators (sha256("global:<snake_name>")[0..8]) ───────
// Verified against IDL discriminator arrays.

const REGISTER_FARMER_DISC = Buffer.from([63, 234, 139, 94, 48, 7, 57, 201]);
const SUBMIT_SCORE_DISC    = Buffer.from([87, 35, 64, 109, 103, 46, 18, 242]);

// ── Loan account offsets ───────────────────────────────────────────────────
// Layout: disc(8) + farmer(32) + token_mint(32) + principal(8) + outstanding(8)
//         + interest_bps(2) + term_days(2) + status(1)

const LOAN_PRINCIPAL_OFFSET = 8 + 32 + 32;
const LOAN_STATUS_OFFSET    = 8 + 32 + 32 + 8 + 8 + 2 + 2;

const LOAN_STATUS_MAP: Record<number, string> = {
  0: 'pending', 1: 'approved', 2: 'active',
  3: 'repaid',  4: 'defaulted', 5: 'liquidated',
};

// ── Oracle keypair loader ──────────────────────────────────────────────────

function loadOracleKeypair(): Keypair | null {
  const raw = process.env.ORACLE_KEYPAIR_BASE58;
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    console.error('[Solana] ORACLE_KEYPAIR_BASE58 is set but could not be decoded');
    return null;
  }
}

// ── Public types ───────────────────────────────────────────────────────────

export interface OnChainLoan  { status: string; principalLamports: number }
export interface OnChainScore { score: number }
export interface RegisterResult {
  pubkey:    string;  // farmer authority public key (base58)
  secretB58: string;  // custodial secret key — store encrypted in production
  sig:       string;  // registerFarmer transaction signature
}

// ── getLoanStatusFromChain ─────────────────────────────────────────────────

export async function getLoanStatusFromChain(
  walletAddress: string,
  loanIndex = 0,
): Promise<OnChainLoan | null> {
  try {
    const authority = new PublicKey(walletAddress);
    const farmer    = farmerPda(authority);
    const loan      = loanPda(farmer, loanIndex);

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

// ── getScoreFromChain ──────────────────────────────────────────────────────

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

// ── registerFarmerOnChain ──────────────────────────────────────────────────
//
// Creates a custodial Solana keypair for a USSD farmer (who has no wallet),
// funds it from the oracle, then calls registerFarmer in the same transaction.
// The phone hash is used as the national_id_hash to avoid storing PII on-chain.
//
// Returns null (and logs) if oracle keypair is missing or the transaction fails.

export async function registerFarmerOnChain(opts: {
  phone:    string;  // E.164 normalised — hashed before submission
  fullName: string;
}): Promise<RegisterResult | null> {
  const oracle = loadOracleKeypair();
  if (!oracle) {
    console.warn('[Solana] ORACLE_KEYPAIR_BASE58 not set — skipping registerFarmer');
    return null;
  }

  try {
    const farmerKeypair    = Keypair.generate();
    const farmerAuthority  = farmerKeypair.publicKey;
    const farmerAccount    = farmerPda(farmerAuthority);

    // Phone number hash → national_id_hash (32 bytes, no PII on-chain)
    const nationalIdHash = createHash('sha256').update(opts.phone).digest();

    // Borsh-encode RegisterFarmerArgs
    const argsData = Buffer.concat([
      nationalIdHash,                          // [u8; 32]  — fixed size, no length prefix
      borshString(opts.fullName.slice(0, 50)), // String
      borshString(opts.phone),                 // String
      borshI64(TANZANIA_LAT_MICRO),            // i64 LE
      borshI64(TANZANIA_LNG_MICRO),            // i64 LE
    ]);

    // Query minimum rent so we don't over-fund (use 256 bytes as generous estimate)
    const minRent   = await connection.getMinimumBalanceForRentExemption(256);
    const fundAmount = minRent + 15_000; // rent + two-signature fee headroom

    // Instruction 1: fund the new keypair from oracle
    const fundIx = SystemProgram.transfer({
      fromPubkey: oracle.publicKey,
      toPubkey:   farmerAuthority,
      lamports:   fundAmount,
    });

    // Instruction 2: registerFarmer
    // Account order (IDL): farmer PDA, authority (signer), system_program
    const registerIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: farmerAccount,           isSigner: false, isWritable: true  },
        { pubkey: farmerAuthority,         isSigner: true,  isWritable: true  },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([REGISTER_FARMER_DISC, argsData]),
    });

    const tx  = new Transaction().add(fundIx, registerIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [oracle, farmerKeypair], {
      commitment: 'confirmed',
    });

    console.log(`[Solana] registerFarmer OK  authority=${farmerAuthority.toBase58()} sig=${sig}`);
    return {
      pubkey:    farmerAuthority.toBase58(),
      secretB58: bs58.encode(farmerKeypair.secretKey),
      sig,
    };
  } catch (err) {
    console.error('[Solana] registerFarmerOnChain failed:', err);
    return null;
  }
}

// ── submitRiskScoreOnChain ─────────────────────────────────────────────────
//
// Sends a SubmitRiskScore instruction signed by the oracle keypair.
// Account order matches the IDL exactly:
//   [0] risk_score  (writable, PDA)
//   [1] farmer      (writable, PDA)
//   [2] oracle_entry (read-only, PDA)
//   [3] oracle      (signer, writable — pays risk_score rent)
//   [4] system_program
//
// Args (Borsh): score: u8, confidence: u8, model_version: string

export async function submitRiskScoreOnChain(
  farmerWallet: string,
  score: number,
  confidence = 70,
  modelVersion = 'ussd-v1.0',
): Promise<string | null> {
  const oracle = loadOracleKeypair();
  if (!oracle) return null;

  try {
    const authority  = new PublicKey(farmerWallet);
    const farmer     = farmerPda(authority);
    const riskScore  = riskScorePda(farmer);
    const oracleEntry = oracleEntryPda(oracle.publicKey);

    // Borsh-encode SubmitRiskScoreArgs
    const argsData = Buffer.concat([
      Buffer.from([score & 0xff]),         // score: u8
      Buffer.from([confidence & 0xff]),    // confidence: u8
      borshString(modelVersion),           // model_version: string
    ]);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: riskScore,            isSigner: false, isWritable: true  }, // [0]
        { pubkey: farmer,               isSigner: false, isWritable: true  }, // [1]
        { pubkey: oracleEntry,          isSigner: false, isWritable: false }, // [2]
        { pubkey: oracle.publicKey,     isSigner: true,  isWritable: true  }, // [3]
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // [4]
      ],
      data: Buffer.concat([SUBMIT_SCORE_DISC, argsData]),
    });

    const tx  = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [oracle], { commitment: 'confirmed' });
    console.log(`[Solana] submitRiskScore OK  score=${score} farmer=${farmerWallet.slice(0, 8)}… sig=${sig}`);
    return sig;
  } catch (err) {
    console.error('[Solana] submitRiskScoreOnChain failed:', err);
    return null;
  }
}
