import api from './api';
import type {
  ConflictAnalysis,
  TimeRecommendation,
  ScheduleOptimization,
  AIPlanningResult,
  WeeklyReportData,
  WeeklyReportHistoryItem,
  WeeklyReportHistoryResponse,
  SaveWeeklyReportResponse
} from '../types';

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

  // VIP专属：保存周报
  async saveWeeklyReport(reportData: WeeklyReportData): Promise<SaveWeeklyReportResponse> {
    const response = await api.post<{ success: boolean; data: SaveWeeklyReportResponse }>(
      '/ai/weekly-report/save',
      reportData
    );
    return response.data.data;
  },

  // VIP专属：获取周报历史列表
  async getWeeklyReportHistory(limit: number = 10): Promise<WeeklyReportHistoryItem[]> {
    const response = await api.get<{ success: boolean; data: WeeklyReportHistoryResponse }>(
      `/ai/weekly-report/history?limit=${limit}`
    );
    return response.data.data.reports;
  },

  // VIP专属：获取周报详情
  async getWeeklyReportDetail(reportId: string): Promise<WeeklyReportData> {
    const response = await api.get<{ success: boolean; data: WeeklyReportData }>(
      `/ai/weekly-report/${reportId}`
    );
    return response.data.data;
  },
};