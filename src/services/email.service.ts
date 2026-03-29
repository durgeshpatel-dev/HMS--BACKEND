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
    const hasConfig = Boolean(
      config.mail.host &&
      config.mail.port &&
      config.mail.user &&
      config.mail.pass &&
      !this.isPlaceholder(config.mail.user) &&
      !this.isPlaceholder(config.mail.pass)
    );
    
    if (!hasConfig) {
      console.warn('[EmailService] SMTP config check failed. User:', config.mail.user, 'Pass length:', config.mail.pass?.length);
    }
    
    return hasConfig;
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

  async send(payload: MailPayload): Promise<boolean> {
    const transporter = this.getTransporter();

    if (!transporter) {
      console.warn('[EmailService] SMTP not configured. Email content logged only.', {
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });
      return false;
    }

    try {
      await transporter.sendMail({
        from: config.mail.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      return true;
    } catch (error: any) {
      console.error('[EmailService] SMTP send failed:', error?.message || error);
      return false;
    }
  }

  sendSignupOtp(email: string, managerName: string, otp: string) {
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

    // Log OTP to console for development/testing
    console.log(`\n[OTP] Email: ${email} | OTP: ${otp} | Expires: ${config.authFlow.signupOtpTtlMinutes} min\n`);

    // Fire-and-forget: send email asynchronously without blocking the API response
    this.send({ to: email, subject, text, html }).catch(err => {
      console.error('[EmailService] sendSignupOtp async error:', err);
    });
  }

  sendPasswordResetEmail(email: string, managerName: string, resetUrl: string) {
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

    // Log reset URL to console for development/testing
    console.log(`\n[PASSWORD RESET] Email: ${email} | Reset URL: ${resetUrl} | Expires: ${config.authFlow.passwordResetTtlMinutes} min\n`);

    // Fire-and-forget: send email asynchronously without blocking the API response
    this.send({ to: email, subject, text, html }).catch(err => {
      console.error('[EmailService] sendPasswordResetEmail async error:', err);
    });
  }
}

export default new EmailService();
