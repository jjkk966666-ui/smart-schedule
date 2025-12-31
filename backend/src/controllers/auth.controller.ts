import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import authService from '../services/auth.service';

export class AuthController {
  async register(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken;
      await authService.logout(req.user!.userId, refreshToken);
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.getCurrentUser(req.user!.userId);
      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  // VIP通行证兑换
  async redeemVipPassport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      
      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: '请提供有效的通行证码',
          },
        });
      }

      const result = await authService.redeemVipPassport(
        req.user!.userId,
        code.trim().toUpperCase()
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // 生成VIP通行证（仅管理员）
  async generateVipPassport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { count = 1 } = req.body;
      
      // 这里可以添加管理员验证逻辑
      // 为了简化，暂时只检查是否有特定的管理员密钥
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '没有权限执行此操作',
          },
        });
      }

      const codes = await authService.generateVipPassport(Math.min(count, 100));
      
      return res.json({
        success: true,
        data: {
          codes,
          count: codes.length,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new AuthController();