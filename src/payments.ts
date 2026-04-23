import AfricasTalking from 'africastalking';

let _at: ReturnType<typeof AfricasTalking> | null = null;

function getAt() {
  if (!_at) {
    _at = AfricasTalking({
      apiKey:   process.env.AT_API_KEY  ?? 'sandbox',
      username: process.env.AT_USERNAME ?? 'sandbox',
    });
  }
  return _at;
}

export interface CheckoutResult {
  success:       boolean;
  transactionId: string | null;
  description:   string;
}

/**
 * Trigger an M-Pesa / mobile-money STK push via Africa's Talking Payments.
 * In sandbox mode the push is simulated and logged.
 */
export async function triggerMobileCheckout(
  phone:   string,
  amount:  number,
  ref:     string,
  type:    'loan_repayment' | 'application_fee' = 'loan_repayment',
): Promise<CheckoutResult> {
  const isSandbox = (process.env.AT_API_KEY ?? 'sandbox') === 'sandbox';
  const normalised = phone.startsWith('+') ? phone : `+${phone}`;

  if (isSandbox) {
    console.log(`[PAYMENT SANDBOX] STK push → ${normalised}  TZS ${amount}  ref=${ref}`);
    return { success: true, transactionId: `SANDBOX-${ref}`, description: 'Sandbox checkout' };
  }

  try {
    const payments = (getAt() as any).PAYMENTS;
    const result   = await payments.mobileCheckout({
      productName:  process.env.AT_PAYMENT_PRODUCT ?? 'VeriFarm',
      phoneNumber:  normalised,
      currencyCode: 'TZS',
      amount,
      metadata:     { ref, type },
    });

    const status = result?.status ?? '';
    const txId   = result?.transactionId ?? null;
    const desc   = result?.description  ?? status;

    return {
      success:       status === 'PendingConfirmation',
      transactionId: txId,
      description:   desc,
    };
  } catch (err) {
    console.error('[PAYMENT] Checkout error:', err);
    return { success: false, transactionId: null, description: 'Payment initiation failed' };
  }
}
