/**
 * Mail service stub (Nodemailer + SMTP in Phase 1 for OTP).
 */
export class MailService {
  async sendMail({ to: _to, subject: _subject, html: _html, text: _text }) {
    throw new Error('MailService.sendMail not implemented (Phase 1)');
  }
}

export const mailService = new MailService();
