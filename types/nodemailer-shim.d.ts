declare module "nodemailer" {
  type TransportOptions = {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user?: string;
      pass?: string;
    };
  };

  type SendMailOptions = {
    from?: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  };

  export function createTransport(options: TransportOptions): {
    sendMail(options: SendMailOptions): Promise<unknown>;
  };

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}
