import dotenv from 'dotenv';

dotenv.config();

// JWT 配置 - 确保类型兼容 jsonwebtoken 库
export const jwtConfig: {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
} = {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};