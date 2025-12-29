import api from './api';
import type {
  Schedule,
  CreateScheduleData,
  UpdateScheduleData,
  ScheduleQueryParams,
  PaginatedResponse,
  ConflictCheckResult,
  ScheduleStats,
  AISuggestion,
  SaveAISuggestionData,
} from '../types';

// 扩展CreateScheduleData以支持AI建议
export interface CreateScheduleWithAIData extends CreateScheduleData {
  aiSuggestion?: {
    content: string;
    metadata?: Record<string, any>;
  };
}

export const scheduleService = {
  async getSchedules(params?: ScheduleQueryParams): Promise<PaginatedResponse<Schedule>> {
    const response = await api.get<{ success: boolean; data: PaginatedResponse<Schedule> }>(
      '/schedules',
      { params }
    );
    return response.data.data;
  },

  async getScheduleById(id: string): Promise<Schedule> {
    const response = await api.get<{ success: boolean; data: Schedule }>(`/schedules/${id}`);
    return response.data.data;
  },

  async createSchedule(data: CreateScheduleWithAIData): Promise<Schedule> {
    const response = await api.post<{ success: boolean; data: Schedule }>('/schedules', data);
    return response.data.data;
  },

  async updateSchedule(id: string, data: UpdateScheduleData): Promise<Schedule> {
    const response = await api.put<{ success: boolean; data: Schedule }>(
      `/schedules/${id}`,
      data
    );
    return response.data.data;
  },

  async deleteSchedule(id: string): Promise<void> {
    await api.delete(`/schedules/${id}`);
  },

  async getCalendarView(startDate: string, endDate: string): Promise<Schedule[]> {
    const response = await api.get<{ success: boolean; data: Schedule[] }>(
      '/schedules/calendar',
      {
        params: { startDate, endDate },
      }
    );
    return response.data.data;
  },

  async checkConflicts(
    startTime: string,
    endTime: string,
    excludeScheduleId?: string
  ): Promise<ConflictCheckResult> {
    const response = await api.get<{ success: boolean; data: ConflictCheckResult }>(
      '/schedules/conflicts/check',
      {
        params: { startTime, endTime, excludeScheduleId },
      }
    );
    return response.data.data;
  },

  async getStats(): Promise<ScheduleStats> {
    const response = await api.get<{ success: boolean; data: ScheduleStats }>(
      '/schedules/stats'
    );
    return response.data.data;
  },

  // AI建议相关方法
  async getAISuggestions(scheduleId: string): Promise<AISuggestion[]> {
    const response = await api.get<{ success: boolean; data: AISuggestion[] }>(
      `/schedules/${scheduleId}/ai-suggestions`
    );
    return response.data.data;
  },

  async saveAISuggestion(scheduleId: string, data: SaveAISuggestionData): Promise<AISuggestion> {
    const response = await api.post<{ success: boolean; data: AISuggestion }>(
      `/schedules/${scheduleId}/ai-suggestions`,
      data
    );
    return response.data.data;
  },
};