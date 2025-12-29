import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import aiService from '../services/ai.service';

export class AIController {
  async analyzeConflicts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await aiService.analyzeConflicts(req.user!.userId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async suggestTime(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { duration } = req.body;
      const result = await aiService.suggestTimeSlots(req.user!.userId, duration);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async optimizeSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.body;
      const result = await aiService.optimizeSchedule(
        req.user!.userId,
        new Date(startDate),
        new Date(endDate)
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // 智能日程规划分析
  async analyzePlanning(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { taskDescription, preferredDuration } = req.body;
      
      if (!taskDescription) {
        return res.status(400).json({
          success: false,
          error: { message: '请提供任务描述' },
        });
      }

      const result = await aiService.analyzeSchedulePlanning(
        req.user!.userId,
        taskDescription,
        preferredDuration
      );
      
      return res.json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // 检查AI配置状态
  async checkAIStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const hasConfig = await aiService.hasAIConfig(req.user!.userId);
      res.json({
        success: true,
        data: {
          hasAIConfig: hasConfig,
          message: hasConfig
            ? 'AI已配置，可以使用智能分析功能'
            : '请先配置AI API密钥才能使用智能分析功能',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AIController();