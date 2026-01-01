// 用户相关类型
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  // VIP相关字段
  isVip?: boolean;
  vipExpiresAt?: string;
  vipRemainingHours?: number;
}

// VIP相关类型
export interface VipStatus {
  isVip: boolean;
  vipExpiresAt: string | null;
  remainingHours: number | null;
}

export interface VipRedeemResult {
  success: boolean;
  message: string;
  vipExpiresAt?: string;
  remainingHours?: number;
}

// AI使用情况类型
export interface AIUsageInfo {
  usageCount: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

// 日程相关类型
export type SchedulePriority = 'low' | 'medium' | 'high' | 'urgent';
export type ScheduleStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Schedule {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  priority: SchedulePriority;
  status: ScheduleStatus;
  isAllDay: boolean;
  recurrenceRule?: string;
  tags?: Tag[];
  aiSuggestions?: AISuggestion[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleData {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  priority: SchedulePriority;
  status?: ScheduleStatus;
  isAllDay?: boolean;
  recurrenceRule?: string;
  tagIds?: string[];
}

export interface UpdateScheduleData extends Partial<CreateScheduleData> {
  id: string;
}

// 标签相关类型
export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CreateTagData {
  name: string;
  color: string;
}

// AI建议相关类型
export type SuggestionType = 'conflict' | 'optimization' | 'recommendation' | 'planning';

export interface AISuggestion {
  id: string;
  scheduleId?: string;
  suggestionType: SuggestionType;
  content: string;
  metadata?: AISuggestionMetadata;
  createdAt: string;
}

export interface AISuggestionMetadata {
  suggestedTimes?: Array<{
    startTime: string;
    endTime: string;
    score: number;
    reason: string;
  }>;
  prioritySuggestion?: string;
  priorityReason?: string;
  coordination?: string;
  efficiencyTips?: string[];
  overallAnalysis?: string;
  // 保存时的额外信息
  taskTitle?: string;
  taskDescription?: string;
  generatedAt?: string;
}

export interface SaveAISuggestionData {
  content: string;
  suggestionType?: SuggestionType;
  metadata?: AISuggestionMetadata;
}

export interface ConflictAnalysis {
  conflicts: Array<{
    scheduleIds: string[];
    type: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
  }>;
  suggestions: Array<{
    scheduleId: string;
    suggestion: string;
    reason: string;
  }>;
}

export interface TimeRecommendation {
  recommendedSlots: Array<{
    startTime: string;
    endTime: string;
    score: number;
    reason: string;
  }>;
  generalAdvice?: string;
  productivityTips?: string[];
  aiPowered?: boolean;
}

export interface AIPlanningResult {
  success: boolean;
  error?: string;
  suggestedTimes?: Array<{
    startTime: string;
    endTime: string;
    score: number;
    reason: string;
  }>;
  prioritySuggestion?: string;
  priorityReason?: string;
  coordination?: string;
  efficiencyTips?: string[];
  overallAnalysis?: string;
  aiPowered?: boolean;
}

// 智能科学规划相关类型
export interface GeneratedScheduleItem {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  priority: SchedulePriority;
  location?: string;
  reason?: string;  // AI安排此日程的理由
}

export interface GeneratePlanResult {
  success: boolean;
  schedules?: GeneratedScheduleItem[];
  summary?: string;
  error?: string;
  // VIP用户使用情况
  usage?: AIUsageInfo;
}

export interface SavePlanResult {
  created: number;
  errors: string[];
}

// 规划历史类型
export interface PlanningHistoryItem {
  id: string;
  description: string;
  generatedPlan: GeneratedScheduleItem[];
  summary: string | null;
  savedCount: number;
  createdAt: string;
}

export interface PlanningHistoryResponse {
  items: PlanningHistoryItem[];
  total: number;
}

export interface ScheduleOptimization {
  optimizations: Array<{
    scheduleId: string;
    currentTime: string;
    suggestedTime: string;
    reason: string;
    impact: string;
  }>;
  overallScore: number;
}

// API响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// 日历视图类型
export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: Schedule;
}

// 查询参数类型
export interface ScheduleQueryParams {
  startDate?: string;
  endDate?: string;
  status?: ScheduleStatus;
  priority?: SchedulePriority;
  tagIds?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 冲突检测相关类型
export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: Schedule[];
}

// 统计信息类型
export interface ScheduleStats {
  total: number;
  pending: number;
  completed: number;
  today: number;
  thisWeek: number;
  highPriority: number;
}

// VIP周报分析相关类型
export interface CategoryBreakdown {
  category: string;
  percentage: number;
  hours: number;
  completedCount: number;
  totalCount: number;
  [key: string]: string | number;  // 添加索引签名以兼容 Recharts 的 ChartDataInput 类型
}

export interface DailyStats {
  date: string;
  dayName: string;
  completed: number;
  total: number;
  completionRate: number;
}

export interface WeeklyReportData {
  success: boolean;
  error?: string;
  // 基础统计
  totalSchedules: number;
  completedSchedules: number;
  incompleteSchedules: number;
  completionRate: number;
  // 分类统计
  categoryBreakdown: CategoryBreakdown[];
  // 每日统计
  dailyStats: DailyStats[];
  // 效率分数 (0-100)
  efficiencyScore: number;
  // AI评价和建议
  aiCommentary: string;
  warnings: string[];
  recommendations: string[];
  // 对比上周
  weekOverWeekChange?: {
    completionRateChange: number;
    efficiencyScoreChange: number;
  };
}
