import jwt from 'jsonwebtoken';
import config from '../config/env';

export interface TokenPayload {
  userId: number;
  userType: 'manager' | 'staff';
  role: string;
  restaurantId: number;
  email?: string;
  phone?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry as any,
  });
};

export const generateRefreshToken = (payload: Omit<TokenPayload, 'email' | 'phone'>): string => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry as any,
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): Omit<TokenPayload, 'email' | 'phone'> => {
  return jwt.verify(token, config.jwt.refreshSecret) as Omit<TokenPayload, 'email' | 'phone'>;
};
