import { Response } from 'express';

export interface LiveEvent {
  type:      'loan_application' | 'repayment' | 'score_update';
  phone:     string;   // masked: +255712***678
  amount?:   number;
  reference?: string;
  score?:    number;
  lang:      string;
  ts:        string;
}

// Connected SSE clients
const clients = new Set<Response>();

export function addClient(res: Response): void {
  clients.add(res);
}

export function removeClient(res: Response): void {
  clients.delete(res);
}

export function broadcast(event: LiveEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function maskPhone(phone: string): string {
  // +255712345678 → +255712***678
  if (phone.length < 7) return '***';
  return phone.slice(0, -6) + '***' + phone.slice(-3);
}
