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

  // VIP专属：周报分析
  async weeklyReport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await aiService.generateWeeklyReport(req.user!.userId);
      
      if (!result.success) {
        return res.status(result.error?.includes('VIP') ? 403 : 500).json({
          success: false,
          error: { message: result.error },
        });
      }
      
      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new AIController();
