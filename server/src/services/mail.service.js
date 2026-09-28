import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
 * Mail service — Nodemailer SMTP; in development without SMTP, logs to console.
 */
class MailService {
  constructor() {
    this.transporter = null;
    if (env.SMTP_HOST && env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: Number(env.SMTP_PORT) === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
  }

  async sendMail({ to, subject, html, text }) {
    if (!this.transporter) {
      console.info('[mail:dev-fallback]', { to, subject, text: text || html });
      return { messageId: `dev-${crypto.randomUUID()}`, accepted: [to] };
    }

    return this.transporter.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      html,
      text,
    });
  }

  async sendPasswordResetOtp(to, otp, fullName) {
    const subject = 'Your Peer Learning password reset code';
    const text = `Hi ${fullName},\n\nYour password reset code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;
    const html = `<p>Hi ${fullName},</p><p>Your password reset code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`;
    return this.sendMail({ to, subject, html, text });
  }
}

export const mailService = new MailService();
