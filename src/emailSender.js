// src/emailSender.js
import { Resend } from 'resend';
import crypto from 'crypto';

export class EmailSender {
  constructor(apiKey, fromEmail) {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  async send({ to, subject, body, replyTo }) {
    const response = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject,
      text: body,
      reply_to: replyTo || this.fromEmail,
      headers: {
        'X-Entity-Ref-ID': crypto.randomUUID()
      }
    });

    return {
      id: response.data?.id || response.id,
      sentAt: new Date().toISOString()
    };
  }

  async sendWithHtml({ to, subject, textBody, htmlBody, replyTo }) {
    const response = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject,
      text: textBody,
      html: htmlBody,
      reply_to: replyTo || this.fromEmail,
      headers: {
        'X-Entity-Ref-ID': crypto.randomUUID()
      }
    });

    return {
      id: response.data?.id || response.id,
      sentAt: new Date().toISOString()
    };
  }
}

export default EmailSender;
