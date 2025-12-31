import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/bcrypt.util';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.util';
import { AppError, RegisterInput, LoginInput, AuthResponse, UpdateUserAIConfigInput } from '../types';

// 临时类型定义：扩展User类型以包含AI配置和VIP字段
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
  vipExpiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// VIP兑换结果接口
interface RedeemResult {
  success: boolean;
  message: string;
  vipExpiresAt?: Date;
  remainingHours?: number;
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
    const user = await (prisma.user as any).findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        vipExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // 计算VIP剩余时间
    const now = new Date();
    const isVip = user.vipExpiresAt ? new Date(user.vipExpiresAt) > now : false;
    const remainingHours = isVip && user.vipExpiresAt
      ? Math.ceil((new Date(user.vipExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60))
      : null;

    return {
      ...user,
      isVip,
      vipRemainingHours: remainingHours,
    };
  }

  // VIP通行证兑换
  async redeemVipPassport(userId: string, code: string): Promise<RedeemResult> {
    // 查找通行证
    const passport = await (prisma as any).vipPassport.findUnique({
      where: { code },
    });

    if (!passport) {
      throw new AppError(400, 'INVALID_CODE', '无效的通行证码');
    }

    if (passport.isUsed) {
      throw new AppError(400, 'CODE_ALREADY_USED', '该通行证码已被使用');
    }

    // 获取用户当前VIP状态
    const user = await prisma.user.findUnique({
      where: { id: userId },
    }) as UserWithAIConfig | null;

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', '用户不存在');
    }

    const now = new Date();
    let newExpiresAt: Date;

    // 如果用户已经是VIP，则延长24小时
    if (user.vipExpiresAt && new Date(user.vipExpiresAt) > now) {
      newExpiresAt = new Date(new Date(user.vipExpiresAt).getTime() + 24 * 60 * 60 * 1000);
    } else {
      // 否则从现在开始24小时
      newExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    // 开始事务：更新用户VIP状态并标记通行证已使用
    await prisma.$transaction([
      (prisma.user as any).update({
        where: { id: userId },
        data: { vipExpiresAt: newExpiresAt },
      }),
      (prisma as any).vipPassport.update({
        where: { code },
        data: {
          isUsed: true,
          usedBy: userId,
          usedAt: now,
        },
      }),
    ]);

    const remainingHours = Math.ceil((newExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));

    return {
      success: true,
      message: `VIP通行证兑换成功！有效期至 ${newExpiresAt.toLocaleString('zh-CN')}`,
      vipExpiresAt: newExpiresAt,
      remainingHours,
    };
  }

  // 生成VIP通行证（管理员使用）
  async generateVipPassport(count: number = 1): Promise<string[]> {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // 生成12位随机码
      const code = this.generateRandomCode(12);
      await (prisma as any).vipPassport.create({
        data: { code },
      });
      codes.push(code);
    }

    return codes;
  }

  // 生成随机码
  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export default new AuthService();