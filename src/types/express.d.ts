import { Request } from 'express';

export interface AuthUser {
  userId: number;
  userType: 'manager' | 'staff';
  role: string;
  restaurantId: number;
  email?: string;
  phone?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
