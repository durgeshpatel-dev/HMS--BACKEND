import rateLimit from 'express-rate-limit';
import config from '../config/env';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Create a production rate limiter
const prodLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
});

// In development, disable rate limiting; in production, use the limiter
export const authRateLimiter = process.env.NODE_ENV === 'development' 
  ? (req: any, res: any, next: any) => next()
  : prodLimiter;
