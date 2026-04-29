import crypto from 'crypto';
import config from '../config/env';

type BillSharePayload = {
  billId: number;
  restaurantId: number;
  exp: number;
};

const getSecret = () => config.app.billShareSecret || config.jwt.accessSecret;

const base64UrlEncode = (input: string) => Buffer.from(input).toString('base64url');
const base64UrlDecode = (input: string) => Buffer.from(input, 'base64url').toString('utf8');

const sign = (payload: string) =>
  crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');

export const createBillShareToken = (payload: BillSharePayload) => {
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadStr);
  return `${payloadStr}.${signature}`;
};

export const verifyBillShareToken = (token: string): BillSharePayload | null => {
  if (!token || !token.includes('.')) return null;
  const [payloadStr, signature] = token.split('.');
  if (!payloadStr || !signature) return null;

  const expected = sign(payloadStr);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadStr)) as BillSharePayload;
    if (!payload?.billId || !payload?.restaurantId || !payload?.exp) return null;
    return payload;
  } catch {
    return null;
  }
};
