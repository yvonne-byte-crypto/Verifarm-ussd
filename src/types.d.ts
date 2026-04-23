declare module 'africastalking' {
  interface AtOptions { apiKey: string; username: string; }
  interface SendParams { to: string[]; message: string; from?: string; }
  interface SMS { send(p: SendParams): Promise<{ SMSMessageData: { Recipients: { statusCode: number; status: string }[] } }>; }
  interface AT { SMS: SMS; }
  function AfricasTalking(options: AtOptions): AT;
  export = AfricasTalking;
}
