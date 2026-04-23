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

/**
 * Send an SMS via Africa's Talking.
 * In sandbox mode (AT_API_KEY=sandbox) the message is logged instead.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  const isSandbox = (process.env.AT_API_KEY ?? 'sandbox') === 'sandbox';

  if (isSandbox) {
    console.log(`[SMS SANDBOX]\n  To: ${to}\n  Message: ${message}`);
    return;
  }

  const normalised = to.startsWith('+') ? to : `+${to}`;
  const params: { to: string[]; message: string; from?: string } = {
    to:      [normalised],
    message,
  };

  if (process.env.AT_SENDER_ID) {
    params.from = process.env.AT_SENDER_ID;
  }

  try {
    const result = await getAt().SMS.send(params);
    const recipient = result.SMSMessageData.Recipients[0];
    if (recipient && recipient.statusCode !== 101) {
      console.warn(`SMS to ${to} status: ${recipient.status}`);
    }
  } catch (err) {
    // Log but don't throw — SMS failure should never crash a USSD session
    console.error(`SMS send failed to ${to}:`, err);
  }
}
