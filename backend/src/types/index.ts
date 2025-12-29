import { Request } from 'express';

// Express扩展类型
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

// 用户相关类型
export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    aiApiKey?: string | null;
    aiApiBaseUrl?: string | null;
    aiModel?: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface UpdateUserAIConfigInput {
  aiApiKey?: string;
  aiApiBaseUrl?: string;
  aiModel?: string;
}

// 日程相关类型
export type SchedulePriority = 'low' | 'medium' | 'high' | 'urgent';
export type ScheduleStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface CreateScheduleInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  priority: SchedulePriority;
  status?: ScheduleStatus;
  isAllDay?: boolean;
  recurrenceRule?: string;
  tagIds?: string[];
}

export interface UpdateScheduleInput extends Partial<CreateScheduleInput> {
  id: string;
}

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

// 标签相关类型
export interface CreateTagInput {
  name: string;
  color: string;
}

export interface UpdateTagInput {
  id: string;
  name?: string;
  color?: string;
}

// AI相关类型
export type SuggestionType = 'conflict' | 'optimization' | 'recommendation';

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

export interface TimeRecommendationInput {
  title: string;
  duration: number; // 分钟
  priority: SchedulePriority;
  preferredTimeRanges?: Array<{
    start: Date;
    end: Date;
  }>;
}

export interface TimeRecommendation {
  recommendedSlots: Array<{
    startTime: Date;
    endTime: Date;
    score: number;
    reason: string;
  }>;
}

export interface ScheduleOptimizationInput {
  startDate: Date;
  endDate: Date;
}

export interface ScheduleOptimization {
  optimizations: Array<{
    scheduleId: string;
    currentTime: Date;
    suggestedTime: Date;
    reason: string;
    impact: string;
  }>;
  overallScore: number;
}

// API响应类型
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// 分页响应类型
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// JWT载荷类型
export interface JwtPayload {
  userId: string;
  email: string;
}

// 错误类型
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}