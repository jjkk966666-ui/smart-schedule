import prisma from '../config/database';
import { AppError, CreateScheduleInput, UpdateScheduleInput, ScheduleQueryParams } from '../types';

// AI建议输入类型
export interface SaveAISuggestionInput {
  scheduleId: string;
  suggestionType: 'conflict' | 'optimization' | 'recommendation' | 'planning';
  content: string;
  metadata?: Record<string, any>;
}

export class ScheduleService {
  async createSchedule(userId: string, input: CreateScheduleInput & { aiSuggestion?: { content: string; metadata?: Record<string, any> } }) {
    const { tagIds, aiSuggestion, ...scheduleData } = input;

    const schedule = await prisma.schedule.create({
      data: {
        ...scheduleData,
        userId,
        scheduleTags: tagIds
          ? {
              create: tagIds.map((tagId) => ({
                tag: { connect: { id: tagId } },
              })),
            }
          : undefined,
        // 如果有AI建议，同时创建
        aiSuggestions: aiSuggestion
          ? {
              create: {
                suggestionType: 'planning',
                content: aiSuggestion.content,
                metadata: aiSuggestion.metadata ? JSON.stringify(aiSuggestion.metadata) : null,
              },
            }
          : undefined,
      },
      include: {
        scheduleTags: {
          include: {
            tag: true,
          },
        },
        aiSuggestions: true,
      },
    });

    return this.formatSchedule(schedule);
  }

  async getSchedules(userId: string, params: ScheduleQueryParams) {
    const { startDate, endDate, status, priority, tagIds, search, page = 1, limit = 50 } = params;

    const where: any = { userId };

    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (tagIds && tagIds.length > 0) {
      where.scheduleTags = {
        some: {
          tagId: { in: tagIds },
        },
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { location: { contains: search } },
      ];
    }

    const [schedules, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: {
          scheduleTags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.schedule.count({ where }),
    ]);

    return {
      items: schedules.map((s) => this.formatSchedule(s)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getScheduleById(userId: string, scheduleId: string) {
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, userId },
      include: {
        scheduleTags: {
          include: {
            tag: true,
          },
        },
        aiSuggestions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!schedule) {
      throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found');
    }

    return this.formatSchedule(schedule);
  }

  // 获取日程的AI建议
  async getScheduleAISuggestions(userId: string, scheduleId: string) {
    // 首先验证日程属于该用户
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, userId },
    });

    if (!schedule) {
      throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found');
    }

    const suggestions = await prisma.aISuggestion.findMany({
      where: { scheduleId },
      orderBy: { createdAt: 'desc' },
    });

    return suggestions.map((s) => ({
      id: s.id,
      scheduleId: s.scheduleId,
      suggestionType: s.suggestionType,
      content: s.content,
      metadata: s.metadata ? JSON.parse(s.metadata) : null,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  // 保存AI建议到日程
  async saveAISuggestion(userId: string, input: SaveAISuggestionInput) {
    // 首先验证日程属于该用户
    const schedule = await prisma.schedule.findFirst({
      where: { id: input.scheduleId, userId },
    });

    if (!schedule) {
      throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found');
    }

    const suggestion = await prisma.aISuggestion.create({
      data: {
        scheduleId: input.scheduleId,
        suggestionType: input.suggestionType,
        content: input.content,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    return {
      id: suggestion.id,
      scheduleId: suggestion.scheduleId,
      suggestionType: suggestion.suggestionType,
      content: suggestion.content,
      metadata: suggestion.metadata ? JSON.parse(suggestion.metadata) : null,
      createdAt: suggestion.createdAt.toISOString(),
    };
  }

  async updateSchedule(userId: string, scheduleId: string, input: UpdateScheduleInput) {
    const existingSchedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, userId },
    });

    if (!existingSchedule) {
      throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found');
    }

    const { tagIds, ...updateData } = input;

    // 更新标签关系
    if (tagIds !== undefined) {
      await prisma.scheduleTag.deleteMany({
        where: { scheduleId },
      });
    }

    const schedule = await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        ...updateData,
        scheduleTags:
          tagIds !== undefined
            ? {
                create: tagIds.map((tagId) => ({
                  tag: { connect: { id: tagId } },
                })),
              }
            : undefined,
      },
      include: {
        scheduleTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return this.formatSchedule(schedule);
  }

  async deleteSchedule(userId: string, scheduleId: string) {
    const schedule = await prisma.schedule.findFirst({
      where: { id: scheduleId, userId },
    });

    if (!schedule) {
      throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found');
    }

    await prisma.schedule.delete({
      where: { id: scheduleId },
    });
  }

  async getCalendarView(userId: string, startDate: string, endDate: string) {
    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        scheduleTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return schedules.map((s) => this.formatSchedule(s));
  }

  /**
   * 检测时间冲突
   * 如果新日程与现有日程时间重叠，返回冲突的日程列表
   */
  async checkConflicts(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeScheduleId?: string
  ) {
    const where: any = {
      userId,
      // 检查时间重叠：新日程开始时间 < 现有日程结束时间 AND 新日程结束时间 > 现有日程开始时间
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } },
      ],
    };

    // 如果是更新操作，排除当前正在更新的日程
    if (excludeScheduleId) {
      where.id = { not: excludeScheduleId };
    }

    const conflicts = await prisma.schedule.findMany({
      where,
      include: {
        scheduleTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return conflicts.map((s) => this.formatSchedule(s));
  }

  /**
   * 获取日程统计信息
   */
  async getScheduleStats(userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [total, pending, completed, today, thisWeek, highPriority] = await Promise.all([
      prisma.schedule.count({ where: { userId } }),
      prisma.schedule.count({ where: { userId, status: 'pending' } }),
      prisma.schedule.count({ where: { userId, status: 'completed' } }),
      prisma.schedule.count({
        where: {
          userId,
          startTime: { gte: todayStart, lt: todayEnd },
        },
      }),
      prisma.schedule.count({
        where: {
          userId,
          startTime: { gte: weekStart, lt: weekEnd },
        },
      }),
      prisma.schedule.count({
        where: {
          userId,
          priority: { in: ['high', 'urgent'] },
          status: 'pending',
        },
      }),
    ]);

    return {
      total,
      pending,
      completed,
      today,
      thisWeek,
      highPriority,
    };
  }

  private formatSchedule(schedule: any) {
    return {
      id: schedule.id,
      userId: schedule.userId,
      title: schedule.title,
      description: schedule.description,
      startTime: schedule.startTime.toISOString(),
      endTime: schedule.endTime.toISOString(),
      location: schedule.location,
      priority: schedule.priority,
      status: schedule.status,
      isAllDay: schedule.isAllDay,
      recurrenceRule: schedule.recurrenceRule,
      tags: schedule.scheduleTags?.map((st: any) => st.tag) || [],
      aiSuggestions: schedule.aiSuggestions?.map((s: any) => ({
        id: s.id,
        suggestionType: s.suggestionType,
        content: s.content,
        metadata: s.metadata ? JSON.parse(s.metadata) : null,
        createdAt: s.createdAt.toISOString(),
      })) || [],
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    };
  }
}

export default new ScheduleService();