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
  private verified = false;

  private isPlaceholder(value: string) {
    const normalized = (value || '').trim().toLowerCase();
    return (
      !normalized ||
      normalized.includes('your-email@gmail.com') ||
      normalized.includes('your-app-password') ||
      normalized.includes('changeme')
    );
  }

  private hasSmtpConfig() {
    return Boolean(
      config.mail.host &&
      config.mail.port &&
      config.mail.user &&
      config.mail.pass &&
      !this.isPlaceholder(config.mail.user) &&
      !this.isPlaceholder(config.mail.pass)
    );
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;
    if (!this.hasSmtpConfig()) return null;

    this.transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure, // false for port 587
      requireTLS: config.mail.port === 587, // STARTTLS required for port 587
      pool: true, // connection pooling for reliability
      auth: {
        user: config.mail.user,
        pass: config.mail.pass,
      },
      tls: {
        rejectUnauthorized: true,
      },
      // Connection timeouts to avoid hanging
      connectionTimeout: 10000, // 10s
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    return this.transporter;
  }

  /**
   * Verify SMTP connection. Safe to call at startup (non-blocking, non-fatal).
   * Returns true if SMTP is reachable and credentials are valid.
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.hasSmtpConfig()) {
      console.warn('[EmailService] SMTP not configured — email features are DISABLED.');
      console.warn('[EmailService]   SMTP_HOST:', config.mail.host || '(empty)');
      console.warn('[EmailService]   SMTP_USER:', config.mail.user || '(empty)');
      return false;
    }

    const transporter = this.getTransporter();
    if (!transporter) return false;

    try {
      await transporter.verify();
      this.verified = true;
      console.log('[EmailService] ✅ SMTP connection verified — email features are ACTIVE.');
      console.log(`[EmailService]   Host: ${config.mail.host}:${config.mail.port}`);
      console.log(`[EmailService]   From: ${config.mail.from}`);
      return true;
    } catch (error: any) {
      this.verified = false;
      console.error('[EmailService] ❌ SMTP verification FAILED — emails will NOT be sent.');
      console.error(`[EmailService]   Host: ${config.mail.host}:${config.mail.port}`);
      console.error(`[EmailService]   User: ${config.mail.user}`);
      console.error(`[EmailService]   Error: ${error?.message || error}`);
      if (error?.code) console.error(`[EmailService]   Code: ${error.code}`);
      if (error?.responseCode) console.error(`[EmailService]   SMTP Response: ${error.responseCode}`);
      return false;
    }
  }

  /** Check if email service is operational */
  isReady(): boolean {
    return this.hasSmtpConfig() && this.verified;
  }

  async send(payload: MailPayload): Promise<boolean> {
    const transporter = this.getTransporter();

    if (!transporter) {
      console.warn('[EmailService] SMTP not configured. Email NOT sent:', {
        to: payload.to,
        subject: payload.subject,
      });
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from: config.mail.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      console.log('[EmailService] ✅ Email sent successfully to:', payload.to, '| MessageId:', info.messageId);
      return true;
    } catch (error: any) {
      console.error('[EmailService] ❌ SMTP send FAILED:');
      console.error(`[EmailService]   To: ${payload.to}`);
      console.error(`[EmailService]   Subject: ${payload.subject}`);
      console.error(`[EmailService]   Error: ${error?.message || error}`);
      if (error?.code) console.error(`[EmailService]   Code: ${error.code}`);
      if (error?.responseCode) console.error(`[EmailService]   SMTP Response: ${error.responseCode}`);
      if (error?.command) console.error(`[EmailService]   Failed Command: ${error.command}`);

      // Reset transporter on auth or connection errors so next attempt retries fresh
      if (error?.code === 'EAUTH' || error?.code === 'ESOCKET' || error?.code === 'ECONNECTION') {
        this.transporter = null;
        this.verified = false;
        console.warn('[EmailService]   Transporter reset due to connection/auth error.');
      }

      return false;
    }
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

    if (config.nodeEnv !== 'production') {
      console.log(`\n[OTP] Email: ${email} | OTP: ${otp} | Expires: ${config.authFlow.signupOtpTtlMinutes} min\n`);
    }

    return this.send({ to: email, subject, text, html });
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

    if (config.nodeEnv !== 'production') {
      console.log(`\n[PASSWORD RESET] Email: ${email} | Reset URL: ${resetUrl} | Expires: ${config.authFlow.passwordResetTtlMinutes} min\n`);
    }

    return this.send({ to: email, subject, text, html });
  }
}

export default new EmailService();
