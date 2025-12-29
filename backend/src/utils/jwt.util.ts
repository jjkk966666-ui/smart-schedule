import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

// 直接从环境变量获取配置，使用类型断言确保兼容性
const JWT_SECRET = process.env.JWT_SECRET as string || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string || 'your-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const generateAccessToken = (payload: JwtPayload): string => {
  const options: any = { expiresIn: JWT_EXPIRES_IN };
  return jwt.sign(payload as object, JWT_SECRET, options);
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  const options: any = { expiresIn: JWT_REFRESH_EXPIRES_IN };
  return jwt.sign(payload as object, JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid access token');
  }
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};