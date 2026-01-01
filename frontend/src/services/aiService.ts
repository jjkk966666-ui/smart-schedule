import api from './api';
import type { ConflictAnalysis, TimeRecommendation, ScheduleOptimization, AIPlanningResult, WeeklyReportData } from '../types';

export const aiService = {
  async analyzeConflicts(): Promise<ConflictAnalysis> {
    const response = await api.post<{ success: boolean; data: ConflictAnalysis }>(
      '/ai/analyze-conflicts'
    );
    return response.data.data;
  },

  async suggestTime(duration: number): Promise<TimeRecommendation> {
    const response = await api.post<{ success: boolean; data: TimeRecommendation }>(
      '/ai/suggest-time',
      { duration }
    );
    return response.data.data;
  },

  async optimizeSchedule(startDate: string, endDate: string): Promise<ScheduleOptimization> {
    const response = await api.post<{ success: boolean; data: ScheduleOptimization }>(
      '/ai/optimize-schedule',
      { startDate, endDate }
    );
    return response.data.data;
  },

  // 智能日程规划分析
  async analyzePlanning(taskDescription: string, preferredDuration?: number): Promise<AIPlanningResult> {
    const response = await api.post<{ success: boolean; data: AIPlanningResult }>(
      '/ai/analyze-planning',
      { taskDescription, preferredDuration }
    );
    return response.data.data;
  },

  // VIP专属：周报分析
  async getWeeklyReport(): Promise<WeeklyReportData> {
    const response = await api.get<{ success: boolean; data: WeeklyReportData }>(
      '/ai/weekly-report'
    );
    return response.data.data;
  },
};
