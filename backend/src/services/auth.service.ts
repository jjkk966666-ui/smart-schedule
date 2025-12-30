import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/bcrypt.util';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';
import { AppError, RegisterInput, LoginInput, AuthResponse, UpdateUserAIConfigInput } from '../types';

// 临时类型定义：扩展User类型以包含AI配置字段
// 注意：运行 `npx prisma generate` 后可以移除此接口
interface UserWithAIConfig {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  avatarUrl: string | null;
  aiApiKey: string | null;
  aiApiBaseUrl: string | null;
  aiModel: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new AppError(400, 'USER_EXISTS', 'User with this email already exists');
    }

    // 创建新用户
    const passwordHash = await hashPassword(input.password);
    const user = (await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
    })) as UserWithAIConfig;

    // 生成令牌
    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 保存刷新令牌
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    // 查找用户
    const user = (await prisma.user.findUnique({
      where: { email: input.email },
    })) as UserWithAIConfig | null;

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // 验证密码
    const isPasswordValid = await comparePassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // 生成令牌
    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // 保存刷新令牌
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string, token: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: {
        userId,
        token,
      },
    });
  }

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    return user;
  }
}

export default new AuthService();