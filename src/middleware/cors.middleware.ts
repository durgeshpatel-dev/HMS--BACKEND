import cors from 'cors';
import config from '../config/env';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = config.cors.origin;
    const isExplicitlyAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes('*');
    const isLocalDevOrigin =
      config.nodeEnv === 'development' &&
      /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);

    if (isExplicitlyAllowed || isLocalDevOrigin) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
