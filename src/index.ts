import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { ussdHandler } from './ussd';
import { initDb, upsertFarmer, getFarmerByPhone, getLatestLoan, updateLoanStatus, updateRepaymentStatus } from './db';
import { submitRiskScoreOnChain } from './solana';
import { addClient, removeClient, broadcast, maskPhone } from './events';

const app = express();

// Allow Vercel frontend + any localhost for dev
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      /\.vercel\.app$/,
      /\.onrender\.com$/,
      /^http:\/\/localhost/,
    ];
    if (!origin || allowed.some(r => r.test(origin))) return cb(null, true);
    cb(new Error('CORS blocked'));
  },
  methods: ['GET', 'POST'],
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Health ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'VeriFarm USSD Server',
    network: process.env.SOLANA_RPC_URL ?? 'devnet',
    ts:      new Date().toISOString(),
  });
});

// ── Africa's Talking USSD callback ─────────────────────────────────────────

app.post('/ussd', ussdHandler);

// ── AT SMS delivery report ─────────────────────────────────────────────────

app.post('/sms/delivery', (req, res) => {
  console.log('[SMS Delivery]', req.body);
  res.sendStatus(200);
});

// ── AT Payments callback (M-Pesa confirmation) ─────────────────────────────

app.post('/payments/callback', async (req: Request, res: Response) => {
  console.log('[Payment Callback]', req.body);

  // Africa's Talking sends: transactionId, status, phoneNumber, value, metadata.*
  const { transactionId, status } = req.body as {
    transactionId?: string;
    status?: string;
  };

  // metadata fields arrive flat as metadata_ref, metadata_type
  const loanRef = (req.body as Record<string, string>)['metadata_ref'] ?? null;

  if (!transactionId) {
    res.sendStatus(200);
    return;
  }

  const confirmed = (status ?? '').toLowerCase() === 'success';
  const txStatus  = confirmed ? 'confirmed' : 'failed';

  await updateRepaymentStatus(transactionId, txStatus);

  if (confirmed && loanRef) {
    await updateLoanStatus(loanRef, 'repaid');
    broadcast({
      type:      'repayment_confirmed',
      reference: loanRef,
      lang:      'en',
      ts:        new Date().toISOString(),
    });
    console.log(`[Payment] ${loanRef} marked repaid — tx: ${transactionId}`);
  }

  res.sendStatus(200);
});

// ── Loan application lookup (for lender dashboard) ─────────────────────────

app.get('/api/applications/by-phone/:phone', async (req: Request, res: Response) => {
  const phone = req.params.phone;
  if (!phone) { res.status(400).json({ error: 'phone required' }); return; }

  const loan = await getLatestLoan(phone).catch(() => null);
  if (!loan) { res.json({ lenderName: null, reference: null, status: null, amount: null }); return; }

  let lenderName: string | null = null;
  try {
    const notes = JSON.parse(loan.notes ?? '{}');
    lenderName = notes.lenderName ?? null;
  } catch {}

  res.json({
    lenderName,
    reference: loan.reference,
    status:    loan.status,
    amount:    loan.amount,
  });
});

// ── SSE live feed (Feature 3) ──────────────────────────────────────────────

app.get('/events', (req: Request, res: Response) => {
  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no', // disable Nginx buffering on Render
  });
  res.flushHeaders();

  // Send a welcome ping so the client knows the stream is open
  res.write(': connected\n\n');

  // Keep-alive ping every 25s (Render closes idle connections at 30s)
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);

  addClient(res);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeClient(res);
  });
});

// ── Oracle score webhook (Feature 1) ──────────────────────────────────────

app.post('/oracle/score', async (req: Request, res: Response) => {
  // Simple bearer-token auth
  const auth   = req.headers.authorization ?? '';
  const secret = process.env.ORACLE_SECRET  ?? 'dev-secret';

  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { phone, score, walletAddress } = req.body as {
    phone: string;
    score: number;
    walletAddress?: string;
  };

  if (!phone || typeof score !== 'number' || score < 0 || score > 100) {
    res.status(400).json({ error: 'phone and score (0-100) required' });
    return;
  }

  // 1. Update DB
  await upsertFarmer(phone, {
    ai_score: score,
    ...(walletAddress ? { wallet_address: walletAddress } : {}),
  });

  // 2. Submit on-chain if wallet known (async — don't block response)
  const resolvedWallet = walletAddress
    ?? (await getFarmerByPhone(phone))?.wallet_address
    ?? null;

  let txSig: string | null = null;
  if (resolvedWallet) {
    txSig = await submitRiskScoreOnChain(resolvedWallet, score);
    if (txSig) console.log(`[Oracle] Score ${score} submitted on-chain: ${txSig}`);
  }

  // 3. Broadcast to SSE clients
  broadcast({
    type:  'score_update',
    phone: maskPhone(phone),
    score,
    lang:  'en',
    ts:    new Date().toISOString(),
  });

  res.json({
    success: true,
    score,
    phone:   maskPhone(phone),
    onChain: txSig ?? 'skipped (no wallet or keypair)',
  });
});

// ── Self-ping (keep Render free tier awake) ────────────────────────────────

function startKeepAlive() {
  const url = process.env.SELF_URL ?? 'https://verifarm-ussd.onrender.com';
  setInterval(async () => {
    try {
      const res = await fetch(`${url}/health`);
      console.log(`[keep-alive] ${res.status} ${new Date().toISOString()}`);
    } catch (err) {
      console.warn('[keep-alive] ping failed:', (err as Error).message);
    }
  }, 10 * 60 * 1000); // every 10 minutes
}

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`VeriFarm USSD server :${PORT}`);
      console.log(`  POST /ussd                          — AT USSD callback`);
      console.log(`  GET  /events                        — SSE live feed`);
      console.log(`  POST /oracle/score                  — AI score webhook`);
      console.log(`  POST /payments/callback             — AT M-Pesa webhook`);
      console.log(`  GET  /api/applications/by-phone/:p  — lender dashboard lookup`);
      console.log(`  SMS  mode           : ${process.env.AT_API_KEY === 'sandbox' ? 'sandbox' : 'live'}`);
    });

    if (process.env.NODE_ENV === 'production') startKeepAlive();
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
