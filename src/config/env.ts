import dotenv from 'dotenv';

dotenv.config({ override: true });

interface Config {
  nodeEnv: string;
  port: number;
  apiVersion: string;
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiry: string;
    refreshExpiry: string;
  };
  cors: {
    origin: string[];
  };
  upload: {
    maxFileSize: number;
    path: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  app: {
    frontendUrl: string;
    publicApiUrl: string;
    billShareSecret: string;
  };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  authFlow: {
    signupOtpTtlMinutes: number;
    passwordResetTtlMinutes: number;
  };
}

const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },
  cors: {
    origin: Array.from(
      new Set([
        ...(process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://localhost:8081')
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
        'https://hms.dppatel.in',
        'https://app.dppatel.in',
        'https://hms-app-prod.web.app',
        'https://hms-app-prod.firebaseapp.com',
        'https://admin.dppatel.in',  // Super Admin Panel
        'http://localhost:5174',
      ])
    ),
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
    path: process.env.UPLOAD_PATH || './uploads',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  app: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    publicApiUrl: process.env.PUBLIC_API_BASE_URL || '',
    billShareSecret: process.env.BILL_SHARE_SECRET || '',
  },
  mail: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@hms.local',
  },
  authFlow: {
    signupOtpTtlMinutes: parseInt(process.env.SIGNUP_OTP_TTL_MINUTES || '10', 10),
    passwordResetTtlMinutes: parseInt(process.env.PASSWORD_RESET_TTL_MINUTES || '30', 10),
  },
};

// Validate required env variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});

export default config;
