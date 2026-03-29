import nodemailer from 'nodemailer';
import config from '../config/env';

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private hasSmtpConfig() {
    return Boolean(config.mail.host && config.mail.port && config.mail.user && config.mail.pass);
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;
    if (!this.hasSmtpConfig()) return null;

    this.transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: {
        user: config.mail.user,
        pass: config.mail.pass,
      },
    });

    return this.transporter;
  }

  async send(payload: MailPayload) {
    const transporter = this.getTransporter();

    if (!transporter) {
      console.warn('[EmailService] SMTP not configured. Email content logged only.', {
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });
      return;
    }

    await transporter.sendMail({
      from: config.mail.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  }

  async sendSignupOtp(email: string, managerName: string, otp: string) {
    const subject = 'Verify your manager account (OTP)';
    const text = `Hi ${managerName},\n\nYour HMS signup OTP is ${otp}. It expires in ${config.authFlow.signupOtpTtlMinutes} minutes.\n\nIf you did not request this, ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2>Verify your manager account</h2>
        <p>Hi ${managerName},</p>
        <p>Your HMS signup OTP is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
        <p>This OTP expires in ${config.authFlow.signupOtpTtlMinutes} minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `;

    await this.send({ to: email, subject, text, html });
  }

  async sendPasswordResetEmail(email: string, managerName: string, resetUrl: string) {
    const subject = 'Reset your HMS manager password';
    const text = `Hi ${managerName},\n\nClick this link to reset your password:\n${resetUrl}\n\nThis link expires in ${config.authFlow.passwordResetTtlMinutes} minutes.\n\nIf you did not request this, ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2>Reset your HMS manager password</h2>
        <p>Hi ${managerName},</p>
        <p>You requested a password reset. Click the button below:</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Reset Password</a>
        </p>
        <p>If the button doesn't work, open this URL:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in ${config.authFlow.passwordResetTtlMinutes} minutes.</p>
      </div>
    `;

    await this.send({ to: email, subject, text, html });
  }
}

export default new EmailService();
