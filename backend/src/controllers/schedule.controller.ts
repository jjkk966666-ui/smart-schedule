import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import scheduleService from '../services/schedule.service';
import aiService from '../services/ai.service';
import prisma from '../config/database';

export class ScheduleController {
  async createSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schedule = await scheduleService.createSchedule(req.user!.userId, req.body);
      res.status(201).json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSchedules(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await scheduleService.getSchedules(req.user!.userId, req.query);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getScheduleById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schedule = await scheduleService.getScheduleById(
        req.user!.userId,
        req.params.id
      );
      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schedule = await scheduleService.updateSchedule(
        req.user!.userId,
        req.params.id,
        req.body
      );
      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteSchedule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await scheduleService.deleteSchedule(req.user!.userId, req.params.id);
      res.json({
        success: true,
        message: 'Schedule deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCalendarView(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const schedules = await scheduleService.getCalendarView(
        req.user!.userId,
        startDate as string,
        endDate as string
      );
      res.json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkConflicts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startTime, endTime, excludeScheduleId } = req.query;
      
      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startTime and endTime are required',
          },
        });
      }

      const conflicts = await scheduleService.checkConflicts(
        req.user!.userId,
        new Date(startTime as string),
        new Date(endTime as string),
        excludeScheduleId as string | undefined
      );

      return res.json({
        success: true,
        data: {
          hasConflicts: conflicts.length > 0,
          conflicts,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await scheduleService.getScheduleStats(req.user!.userId);
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  // 获取日程的AI建议
  async getAISuggestions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const suggestions = await scheduleService.getScheduleAISuggestions(
        req.user!.userId,
        req.params.id
      );
      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  }

  // 保存AI建议到日程
  async saveAISuggestion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { content, metadata, suggestionType } = req.body;
      
      if (!content) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'content is required',
          },
        });
      }

      const suggestion = await scheduleService.saveAISuggestion(req.user!.userId, {
        scheduleId: req.params.id,
        suggestionType: suggestionType || 'planning',
        content,
        metadata,
      });
      
      return res.status(201).json({
        success: true,
        data: suggestion,
      });
    } catch (error) {
      return next(error);
    }
  }

  // 智能科学规划 - 根据描述生成日程
  async generatePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { description } = req.body;
      
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请输入日程描述',
          },
        });
      }

      const result = await aiService.generateSchedulePlan(req.user!.userId, description.trim());
      
      return res.json({
        success: result.success,
        data: result.success ? {
          schedules: result.schedules,
          summary: result.summary,
        } : undefined,
        error: result.success ? undefined : {
          code: 'AI_ERROR',
          message: result.error,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // 批量保存生成的日程
  async savePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { schedules, description, summary } = req.body;
      
      if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请提供要保存的日程列表',
          },
        });
      }

      const result = await aiService.batchCreateSchedules(req.user!.userId, schedules);
      
      // 保存规划历史
      if (description && result.created > 0) {
        try {
          // @ts-ignore - 需要运行 npx prisma generate 后类型会正确
          await (prisma as any).planningHistory.create({
            data: {
              userId: req.user!.userId,
              description,
              generatedPlan: JSON.stringify(schedules),
              summary: summary || `生成了 ${schedules.length} 个日程`,
              savedCount: result.created,
            },
          });
        } catch (historyError) {
          console.error('保存规划历史失败:', historyError);
          // 不阻断主流程
        }
      }
      
      return res.status(result.success ? 201 : 400).json({
        success: result.success,
        data: {
          created: result.created,
          errors: result.errors,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // 获取规划历史
  async getPlanningHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      
      // @ts-ignore - 需要运行 npx prisma generate 后类型会正确
      const history = await (prisma as any).planningHistory.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      });
      
      // @ts-ignore - 需要运行 npx prisma generate 后类型会正确
      const total = await (prisma as any).planningHistory.count({
        where: { userId: req.user!.userId },
      });
      
      return res.json({
        success: true,
        data: {
          items: history.map((h: any) => ({
            id: h.id,
            description: h.description,
            generatedPlan: JSON.parse(h.generatedPlan),
            summary: h.summary,
            savedCount: h.savedCount,
            createdAt: h.createdAt.toISOString(),
          })),
          total,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // 删除规划历史
  async deletePlanningHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { historyId: id } = req.params;
      
      // 验证所有权
      // @ts-ignore - 需要运行 npx prisma generate 后类型会正确
      const history = await (prisma as any).planningHistory.findFirst({
        where: { id, userId: req.user!.userId },
      });
      
      if (!history) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '规划历史不存在',
          },
        });
      }
      
      // @ts-ignore - 需要运行 npx prisma generate 后类型会正确
      await (prisma as any).planningHistory.delete({
        where: { id },
      });
      
      return res.json({
        success: true,
        message: '删除成功',
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new ScheduleController();