import OpenAI from 'openai';
import {
  openai as defaultOpenai,
  openaiConfig,
  premiumOpenai,
  premiumConfig,
  usageLimits
} from '../config/openai';
import prisma from '../config/database';

// 用户VIP状态接口
interface UserVipStatus {
  isVip: boolean;
  vipExpiresAt: Date | null;
  remainingHours: number | null;
}

// 用户每日使用情况接口
interface UserDailyUsage {
  usageCount: number;
  limit: number;
  remaining: number;
  isLimitReached: boolean;
}

interface AITimeSlot {
  startTime: string;
  endTime: string;
  score: number;
  reason: string;
}

interface AIAnalysisResult {
  recommendations: AITimeSlot[];
  generalAdvice: string;
  productivityTips: string[];
}

// 智能规划生成的日程项
interface GeneratedScheduleItem {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  location?: string;
  reason?: string;  // AI安排此日程的理由
}

interface GeneratePlanResult {
  success: boolean;
  schedules?: GeneratedScheduleItem[];
  summary?: string;
  error?: string;
}

// 周报分析相关类型
interface CategoryBreakdown {
  category: string;
  percentage: number;
  hours: number;
  completedCount: number;
  totalCount: number;
}

interface DailyStats {
  date: string;
  dayName: string;
  completed: number;
  total: number;
  completionRate: number;
}

interface WeeklyReportData {
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

export class AIService {
  // 清理AI响应，移除思考标签和提取JSON
  private cleanAIResponse(response: string): string {
    let cleaned = response;
    
    console.log('=== 原始AI响应 ===');
    console.log(response.substring(0, 1000));
    console.log('=== 原始响应结束 ===');
    
    // 移除各种思考标签及其内容
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    cleaned = cleaned.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
    
    // 移除可能的markdown标题和说明文字
    cleaned = cleaned.replace(/^#+\s+.*$/gm, '');
    cleaned = cleaned.replace(/^(好的|明白|以下是|根据|这是|我来|让我|下面是).*[:：]\s*/gm, '');
    
    // 移除代码块标记（支持多种格式，包括带语言标记的）
    // 先尝试提取代码块内的内容
    const codeBlockMatch = cleaned.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleaned = codeBlockMatch[1];
    } else {
      // 如果没有代码块，移除单独的```标记
      cleaned = cleaned.replace(/```json\s*/gi, '');
      cleaned = cleaned.replace(/```JSON\s*/gi, '');
      cleaned = cleaned.replace(/```\s*/gi, '');
    }
    
    // 移除可能的文本说明（如 "以下是JSON格式的结果："）
    cleaned = cleaned.replace(/^[^{\[]*(?=[\{\[])/s, '');
    
    // 尝试找到最外层的JSON对象或数组
    let braceCount = 0;
    let bracketCount = 0;
    let jsonStart = -1;
    let jsonEnd = -1;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      
      // 处理字符串内的字符
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') {
        if (jsonStart === -1 && bracketCount === 0) jsonStart = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && bracketCount === 0 && jsonStart !== -1) {
          jsonEnd = i + 1;
          break;
        }
      } else if (char === '[') {
        if (jsonStart === -1 && braceCount === 0) jsonStart = i;
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
        if (bracketCount === 0 && braceCount === 0 && jsonStart !== -1) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.substring(jsonStart, jsonEnd);
    }
    
    // 修复常见的JSON格式问题
    // 移除尾随逗号
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    // 修复没有引号的键名（简单情况）
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    
    console.log('=== 清理后的JSON ===');
    console.log(cleaned.substring(0, 1000));
    console.log('=== 清理后结束 ===');
    
    return cleaned.trim();
  }

  // 安全解析JSON，带有更好的错误处理和多种尝试策略
  private safeParseJSON<T>(response: string, fallback: T): { data: T; parsed: boolean; rawResponse: string } {
    // 策略1: 使用清理后的响应
    try {
      const cleaned = this.cleanAIResponse(response);
      const data = JSON.parse(cleaned) as T;
      console.log('=== JSON解析成功 (策略1: 清理后解析) ===');
      console.log('解析结果:', JSON.stringify(data, null, 2).substring(0, 500));
      return { data, parsed: true, rawResponse: response };
    } catch (error1) {
      console.log('策略1失败:', (error1 as Error).message);
    }

    // 策略2: 尝试提取最深层的JSON对象
    try {
      const jsonMatches = response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (jsonMatches && jsonMatches.length > 0) {
        // 找最长的匹配（通常是最完整的JSON）
        const longestMatch = jsonMatches.reduce((a, b) => a.length > b.length ? a : b);
        const data = JSON.parse(longestMatch) as T;
        console.log('=== JSON解析成功 (策略2: 提取最长JSON) ===');
        return { data, parsed: true, rawResponse: response };
      }
    } catch (error2) {
      console.log('策略2失败:', (error2 as Error).message);
    }

    // 策略3: 尝试修复常见的JSON错误后解析
    try {
      let fixed = this.cleanAIResponse(response);
      // 修复单引号
      fixed = fixed.replace(/'/g, '"');
      // 修复未转义的换行符
      fixed = fixed.replace(/\n/g, '\\n');
      // 移除控制字符
      fixed = fixed.replace(/[\x00-\x1F\x7F]/g, '');
      const data = JSON.parse(fixed) as T;
      console.log('=== JSON解析成功 (策略3: 修复后解析) ===');
      return { data, parsed: true, rawResponse: response };
    } catch (error3) {
      console.log('策略3失败:', (error3 as Error).message);
    }

    // 策略4: 尝试提取schedules数组
    try {
      const schedulesMatch = response.match(/"schedules"\s*:\s*\[([\s\S]*?)\]/);
      if (schedulesMatch) {
        const schedulesJson = `{"schedules":[${schedulesMatch[1]}]}`;
        const data = JSON.parse(schedulesJson) as T;
        console.log('=== JSON解析成功 (策略4: 提取schedules) ===');
        return { data, parsed: true, rawResponse: response };
      }
    } catch (error4) {
      console.log('策略4失败:', (error4 as Error).message);
    }

    console.log('=== 所有JSON解析策略都失败 ===');
    console.log('原始响应前1000字符:', response.substring(0, 1000));
    return { data: fallback, parsed: false, rawResponse: response };
  }

  // 从JSON解析结果中提取可读分析文本
  private extractAnalysisFromResult(result: any): string {
    const parts: string[] = [];
    
    // 提取各种可能的分析字段
    if (result.overallAnalysis) {
      parts.push(`📊 整体分析:\n${result.overallAnalysis}`);
    }
    
    if (result.coordination) {
      parts.push(`📅 日程协调建议:\n${result.coordination}`);
    }
    
    if (result.priorityReason) {
      parts.push(`🎯 优先级建议:\n${result.priorityReason}`);
    }
    
    if (result.efficiencyTips && result.efficiencyTips.length > 0) {
      parts.push(`💡 效率建议:\n${result.efficiencyTips.map((tip: string, i: number) => `${i + 1}. ${tip}`).join('\n')}`);
    }
    
    if (result.generalAdvice) {
      parts.push(`📝 总体建议:\n${result.generalAdvice}`);
    }
    
    if (result.productivityTips && result.productivityTips.length > 0) {
      parts.push(`⚡ 效率提示:\n${result.productivityTips.map((tip: string, i: number) => `${i + 1}. ${tip}`).join('\n')}`);
    }
    
    return parts.length > 0 ? parts.join('\n\n') : '';
  }

  // 从原始AI响应中提取可读文本（增强版）
  private extractReadableText(response: string): string {
    let text = response;
    
    // 移除各种思考标签及其内容
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    
    // 尝试先解析JSON并提取有意义的内容
    try {
      const cleaned = this.cleanAIResponse(response);
      const jsonData = JSON.parse(cleaned);
      const extracted = this.extractAnalysisFromResult(jsonData);
      if (extracted && extracted.length > 20) {
        return extracted;
      }
      
      // 如果有summary字段，直接返回
      if (jsonData.summary && jsonData.summary.length > 10) {
        return jsonData.summary;
      }
      
      // 如果有error字段，返回错误信息
      if (jsonData.error) {
        return `AI返回错误: ${jsonData.error}`;
      }
    } catch (e) {
      // 解析失败，继续使用文本提取
    }
    
    // 移除代码块（包括内容）
    text = text.replace(/```[\s\S]*?```/g, '');
    
    // 尝试提取JSON中的文本字段（使用更宽松的正则）
    const textFields = [
      /"overallAnalysis"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
      /"coordination"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
      /"priorityReason"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
      /"generalAdvice"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
      /"reason"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
      /"summary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
      /"description"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
      /"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/,
    ];
    
    const extractedTexts: string[] = [];
    for (const regex of textFields) {
      const matches = response.matchAll(new RegExp(regex, 'g'));
      for (const match of matches) {
        if (match[1] && match[1].length > 5) {
          // 解码转义字符
          const decoded = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          if (!extractedTexts.includes(decoded)) {
            extractedTexts.push(decoded);
          }
        }
      }
    }
    
    if (extractedTexts.length > 0) {
      return extractedTexts.slice(0, 5).join('\n\n');
    }
    
    // 移除JSON对象（保守方式）
    text = text.replace(/\{[\s\S]*?\}/g, '');
    
    // 移除常见的AI响应前缀
    text = text.replace(/^(好的|明白|以下是|根据你的要求|这是|我将|我来|让我).*/gm, '');
    
    // 清理多余空白
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    // 如果清理后没有有效文本，尝试提取原始响应中的有意义段落
    if (!text || text.length < 10) {
      const lines = response.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 15 &&
               !trimmed.startsWith('{') &&
               !trimmed.startsWith('}') &&
               !trimmed.startsWith('[') &&
               !trimmed.startsWith(']') &&
               !trimmed.startsWith('```') &&
               !trimmed.startsWith('"') &&
               !trimmed.startsWith('<') &&
               !/^\s*[\d.]+\s*$/.test(trimmed); // 排除纯数字行
      });
      
      if (lines.length > 0) {
        return lines.slice(0, 5).join('\n');
      }
      
      // 如果还是没有有效内容，返回更有用的错误信息
      return 'AI返回的内容格式异常，无法解析为日程。请尝试使用更简洁、具体的描述重新生成。';
    }
    
    return text;
  }

  // 检查用户是否是VIP
  async isUserVip(userId: string): Promise<UserVipStatus> {
    // 使用类型断言绕过Prisma类型尚未生成的问题
    const user = await (prisma.user as any).findUnique({
      where: { id: userId },
      select: { vipExpiresAt: true },
    }) as { vipExpiresAt: Date | null } | null;

    const now = new Date();
    const vipExpiresAt = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : null;
    const isVip = vipExpiresAt ? vipExpiresAt > now : false;
    const remainingHours = isVip && vipExpiresAt
      ? Math.ceil((vipExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
      : null;

    return {
      isVip,
      vipExpiresAt,
      remainingHours,
    };
  }

  // 获取用户今日使用情况
  async getUserDailyUsage(userId: string): Promise<UserDailyUsage> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const vipStatus = await this.isUserVip(userId);
    const limit = vipStatus.isVip ? usageLimits.vip : usageLimits.normal;

    // 使用类型断言绕过Prisma类型尚未生成的问题
    const usageRecord = await (prisma as any).aIUsageRecord.findUnique({
      where: {
        userId_usageDate: {
          userId,
          usageDate: today,
        },
      },
    }) as { usageCount: number } | null;

    const usageCount = usageRecord?.usageCount || 0;
    const remaining = Math.max(0, limit - usageCount);

    return {
      usageCount,
      limit,
      remaining,
      isLimitReached: remaining === 0,
    };
  }

  // 增加用户每日使用次数
  async incrementUsage(userId: string): Promise<UserDailyUsage> {
    const today = new Date().toISOString().split('T')[0];
    
    // 使用类型断言绕过Prisma类型尚未生成的问题
    const usageRecord = await (prisma as any).aIUsageRecord.upsert({
      where: {
        userId_usageDate: {
          userId,
          usageDate: today,
        },
      },
      update: {
        usageCount: { increment: 1 },
      },
      create: {
        userId,
        usageDate: today,
        usageCount: 1,
      },
    }) as { usageCount: number };

    const vipStatus = await this.isUserVip(userId);
    const limit = vipStatus.isVip ? usageLimits.vip : usageLimits.normal;
    const remaining = Math.max(0, limit - usageRecord.usageCount);

    return {
      usageCount: usageRecord.usageCount,
      limit,
      remaining,
      isLimitReached: remaining === 0,
    };
  }

  // 获取OpenAI客户端（根据用户VIP状态选择）
  private async getOpenAIClientForUser(userId: string): Promise<{ client: OpenAI | null; model: string; isVip: boolean }> {
    const vipStatus = await this.isUserVip(userId);
    
    if (vipStatus.isVip && premiumOpenai) {
      // VIP用户使用Premium API
      console.log(`[AI] 用户 ${userId} 使用VIP模型: ${premiumConfig.model}`);
      return {
        client: premiumOpenai,
        model: premiumConfig.model,
        isVip: true,
      };
    }
    
    // 普通用户或没有Premium配置时使用默认API
    if (process.env.OPENAI_API_KEY) {
      console.log(`[AI] 用户 ${userId} 使用普通模型: ${openaiConfig.model}`);
      return {
        client: defaultOpenai,
        model: openaiConfig.model,
        isVip: false,
      };
    }
    
    return { client: null, model: '', isVip: false };
  }

  // 获取OpenAI客户端（仅使用系统级配置）- 保留向后兼容
  private getOpenAIClient(): OpenAI | null {
    // 使用系统默认配置
    if (process.env.OPENAI_API_KEY) {
      return defaultOpenai;
    }
    return null;
  }

  // 获取AI模型配置（仅使用系统级配置）- 保留向后兼容
  private getAIModel(): string {
    return openaiConfig.model;
  }

  // 检查系统是否配置了AI
  async hasAIConfig(): Promise<boolean> {
    return process.env.OPENAI_API_KEY !== undefined;
  }

  // 获取VIP状态信息（供外部调用）
  async getVipStatus(userId: string): Promise<{ isVip: boolean; expiresAt: Date | null; remainingHours: number | null }> {
    const status = await this.isUserVip(userId);
    return {
      isVip: status.isVip,
      expiresAt: status.vipExpiresAt,
      remainingHours: status.remainingHours,
    };
  }

  async analyzeConflicts(userId: string) {
    const schedules = await prisma.schedule.findMany({
      where: { userId },
      orderBy: { startTime: 'asc' },
    });

    const conflicts: any[] = [];
    const suggestions: any[] = [];

    // 简单的冲突检测逻辑
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const s1 = schedules[i];
        const s2 = schedules[j];

        // 检查时间重叠
        if (
          (s1.startTime <= s2.startTime && s1.endTime > s2.startTime) ||
          (s2.startTime <= s1.startTime && s2.endTime > s1.startTime)
        ) {
          conflicts.push({
            scheduleIds: [s1.id, s2.id],
            type: 'time_overlap',
            severity: 'high',
            description: `"${s1.title}" 和 "${s2.title}" 时间冲突`,
          });

          suggestions.push({
            scheduleId: s1.id,
            suggestion: `考虑重新安排 "${s1.title}" 的时间`,
            reason: '与其他日程冲突',
          });
        }
      }
    }

    // 尝试使用AI增强分析
    if (conflicts.length > 0) {
      try {
        const openaiClient = this.getOpenAIClient();
        if (openaiClient) {
          const model = this.getAIModel();
          const prompt = `分析以下日程冲突并提供建议:\n${JSON.stringify(conflicts, null, 2)}`;
          
          const completion = await openaiClient.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: openaiConfig.temperature,
            max_tokens: 500,
          });

          const aiSuggestion = completion.choices[0]?.message?.content || '';
          if (aiSuggestion) {
            suggestions.push({
              scheduleId: 'general',
              suggestion: aiSuggestion,
              reason: 'AI建议',
            });
          }
        }
      } catch (error) {
        console.log('AI分析失败，使用基础分析:', error);
      }
    }

    return { conflicts, suggestions };
  }

  async suggestTimeSlots(userId: string, duration: number) {
    const now = new Date();
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        startTime: {
          gte: now,
          lte: endOfWeek,
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // 基础时间段分析
    const basicSlots = this.findFreeSlots(schedules, now, endOfWeek, duration);

    // 尝试使用AI增强推荐
    try {
      const openaiClient = this.getOpenAIClient();
      if (openaiClient) {
        const model = this.getAIModel();
        
        // 准备日程数据给AI分析
        const scheduleData = schedules.map(s => ({
          title: s.title,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime.toISOString(),
          priority: s.priority,
        }));

        const prompt = `你是一个智能日程助手。请分析用户的日程安排，并推荐最佳的空闲时间段来安排新任务。

当前时间: ${now.toISOString()}
需要安排的任务时长: ${duration} 分钟

用户现有日程:
${JSON.stringify(scheduleData, null, 2)}

基础空闲时段分析:
${JSON.stringify(basicSlots.slice(0, 10), null, 2)}

请根据以下因素推荐最佳时间段:
1. 避免与现有日程冲突
2. 考虑工作效率（上午通常更适合专注工作）
3. 考虑休息时间（避免连续安排任务）
4. 考虑任务优先级的分布

请以JSON格式返回推荐结果，格式如下:
{
  "recommendations": [
    {
      "startTime": "ISO时间格式",
      "endTime": "ISO时间格式",
      "score": 0.0-1.0的评分,
      "reason": "推荐理由"
    }
  ],
  "generalAdvice": "总体建议",
  "productivityTips": ["效率建议1", "效率建议2"]
}

只返回JSON，不要其他内容。`;

        const completion = await openaiClient.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
        });

        const aiResponse = completion.choices[0]?.message?.content || '';
        
        console.log('=== suggestTimeSlots AI响应 ===');
        
        // 使用增强的JSON解析
        const { data: aiResult, parsed, rawResponse } = this.safeParseJSON<AIAnalysisResult>(aiResponse, {
          recommendations: [],
          generalAdvice: '',
          productivityTips: [],
        });
        
        if (parsed && aiResult.recommendations && aiResult.recommendations.length > 0) {
          // 从解析结果中提取可读分析
          const analysisText = this.extractAnalysisFromResult(aiResult);
          return {
            recommendedSlots: aiResult.recommendations.slice(0, 5),
            generalAdvice: analysisText || aiResult.generalAdvice || '根据您的日程安排，以上是推荐的时间段',
            productivityTips: aiResult.productivityTips || [],
            aiPowered: true,
          };
        } else {
          // 如果解析失败，返回基础分析结果加上提取的可读文本
          const readableAdvice = this.extractReadableText(rawResponse);
          return {
            recommendedSlots: basicSlots.slice(0, 5),
            generalAdvice: readableAdvice || '时间推荐分析完成',
            aiPowered: true,
          };
        }
      }
    } catch (error) {
      console.log('AI推荐失败，使用基础分析:', error);
    }

    // 如果没有AI或AI失败，返回基础分析结果
    return {
      recommendedSlots: basicSlots.slice(0, 5),
      aiPowered: false,
    };
  }

  // 基础时间段分析逻辑
  private findFreeSlots(schedules: any[], startDate: Date, endDate: Date, duration: number) {
    const recommendedSlots: any[] = [];
    let currentTime = new Date(startDate);
    currentTime.setHours(9, 0, 0, 0);

    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    for (let day = 0; day < Math.min(dayCount, 7); day++) {
      const dayStart = new Date(currentTime);
      dayStart.setDate(dayStart.getDate() + day);
      dayStart.setHours(9, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(18, 0, 0, 0);

      let checkTime = new Date(dayStart);
      while (checkTime < dayEnd) {
        const slotEnd = new Date(checkTime.getTime() + duration * 60 * 1000);

        const hasConflict = schedules.some((s) => {
          return (
            (checkTime >= s.startTime && checkTime < s.endTime) ||
            (slotEnd > s.startTime && slotEnd <= s.endTime)
          );
        });

        if (!hasConflict && slotEnd <= dayEnd) {
          // 根据时间段给予不同的评分
          const hour = checkTime.getHours();
          let score = 0.7;
          let reason = '空闲时段';
          
          if (hour >= 9 && hour < 12) {
            score = 0.95;
            reason = '上午黄金时段，专注力最强';
          } else if (hour >= 14 && hour < 16) {
            score = 0.85;
            reason = '下午效率时段';
          } else if (hour >= 12 && hour < 14) {
            score = 0.6;
            reason = '午休时段，可能影响精力';
          }

          recommendedSlots.push({
            startTime: checkTime.toISOString(),
            endTime: slotEnd.toISOString(),
            score,
            reason,
          });
        }

        checkTime = new Date(checkTime.getTime() + 30 * 60 * 1000);
      }
    }

    // 按评分排序
    return recommendedSlots.sort((a, b) => b.score - a.score);
  }

  // 智能日程规划分析
  async analyzeSchedulePlanning(userId: string, taskDescription: string, preferredDuration?: number) {
    const now = new Date();
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        startTime: {
          gte: now,
          lte: endOfWeek,
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const openaiClient = this.getOpenAIClient();
    if (!openaiClient) {
      return {
        success: false,
        error: 'AI服务未配置，请联系管理员',
      };
    }

    const model = this.getAIModel();
    
    const scheduleData = schedules.map(s => ({
      title: s.title,
      description: s.description,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      priority: s.priority,
      status: s.status,
    }));

    const prompt = `你是一个专业的时间管理和日程规划AI助手。用户想要安排一个新任务，请帮助分析并给出建议。

当前时间: ${now.toISOString()}

用户想要安排的任务:
"${taskDescription}"
${preferredDuration ? `预计时长: ${preferredDuration} 分钟` : ''}

用户本周现有日程:
${JSON.stringify(scheduleData, null, 2)}

请分析用户的日程安排模式，并提供:
1. 最佳时间建议（考虑用户的工作习惯和现有安排）
2. 任务优先级建议
3. 如何与现有日程协调
4. 效率优化建议

请以JSON格式返回:
{
  "suggestedTimes": [
    {
      "startTime": "ISO时间格式",
      "endTime": "ISO时间格式",
      "score": 0.0-1.0,
      "reason": "详细理由"
    }
  ],
  "prioritySuggestion": "low/medium/high/urgent",
  "priorityReason": "优先级建议理由",
  "coordination": "与现有日程的协调建议",
  "efficiencyTips": ["建议1", "建议2"],
  "overallAnalysis": "整体分析和建议"
}`;

    try {
      const completion = await openaiClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const aiResponse = completion.choices[0]?.message?.content || '';
      
      console.log('=== analyzeSchedulePlanning AI响应 ===');
      console.log('响应长度:', aiResponse.length);
      
      // 定义预期的结果类型
      interface PlanningResult {
        suggestedTimes?: AITimeSlot[];
        prioritySuggestion?: string;
        priorityReason?: string;
        coordination?: string;
        efficiencyTips?: string[];
        overallAnalysis?: string;
      }

      // 使用增强的JSON解析
      const { data: result, parsed, rawResponse } = this.safeParseJSON<PlanningResult>(aiResponse, {});
      
      console.log('解析状态:', parsed);
      console.log('结果字段数:', Object.keys(result).length);
      
      if (parsed && Object.keys(result).length > 0) {
        // 从解析结果中构建更丰富的分析文本
        const analysisText = this.extractAnalysisFromResult(result);
        
        return {
          success: true,
          suggestedTimes: result.suggestedTimes || [],
          prioritySuggestion: result.prioritySuggestion,
          priorityReason: result.priorityReason,
          coordination: result.coordination,
          efficiencyTips: result.efficiencyTips || [],
          overallAnalysis: analysisText || result.overallAnalysis || '分析完成',
          aiPowered: true,
        };
      } else {
        // 如果解析失败，提取可读文本作为整体分析
        console.log('JSON解析失败，尝试提取可读文本');
        const readableAnalysis = this.extractReadableText(rawResponse);
        console.log('提取的可读文本:', readableAnalysis.substring(0, 200));
        
        return {
          success: true,
          overallAnalysis: readableAnalysis || 'AI分析已完成，但响应格式无法完全解析。',
          aiPowered: true,
        };
      }
    } catch (error: any) {
      console.error('AI分析失败:', error);
      return {
        success: false,
        error: `AI分析失败: ${error.message || '未知错误'}`,
      };
    }
  }

  // 智能科学规划 - 根据模糊描述生成具体日程
  async generateSchedulePlan(userId: string, description: string): Promise<GeneratePlanResult & { usage?: UserDailyUsage }> {
    const now = new Date();
    
    // 检查每日使用限制
    const currentUsage = await this.getUserDailyUsage(userId);
    if (currentUsage.isLimitReached) {
      const vipStatus = await this.isUserVip(userId);
      return {
        success: false,
        error: vipStatus.isVip
          ? `今日VIP使用次数已达上限(${currentUsage.limit}次)，请明天再试`
          : `今日使用次数已达上限(${currentUsage.limit}次)，升级VIP可获得更多次数`,
        usage: currentUsage,
      };
    }

    // 获取适合用户的AI客户端
    const { client: openaiClient, model, isVip } = await this.getOpenAIClientForUser(userId);
    if (!openaiClient) {
      return {
        success: false,
        error: 'AI服务未配置，请联系管理员',
      };
    }
    
    // 获取用户现有日程以避免冲突
    const endOfWeek = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 未来两周
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        userId,
        startTime: {
          gte: now,
          lte: endOfWeek,
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const existingScheduleData = existingSchedules.map(s => ({
      title: s.title,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
    }));

    const prompt = `你是一个专业的时间管理和日程规划AI助手。用户用自然语言描述了他们的日程安排需求，请帮助将其转换为具体的、可执行的日程列表。

当前时间: ${now.toISOString()}
当前日期: ${now.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
用户时区: Asia/Shanghai (UTC+8)

用户的日程需求描述:
"${description}"

用户现有日程（请避免时间冲突）:
${existingScheduleData.length > 0 ? JSON.stringify(existingScheduleData, null, 2) : '暂无现有日程'}

请根据用户的描述，生成具体的日程安排。要求：
1. 将模糊的时间描述转换为精确的日期和时间：
   - "早上/上午" → 08:00-12:00
   - "下午" → 14:00-18:00
   - "晚上" → 19:00-22:00
   - 除非用户明确说要熬夜或通宵，否则不要安排22:00以后的日程
2. 如果用户说"这周一到周三"，请根据当前日期计算出具体日期
3. 确保生成的日程时间不与现有日程重叠
4. 每个日程都要有合理的时长（通常1-3小时）
5. 根据任务性质设置合适的优先级

**重要的时间限制规则**：
- 所有日程必须安排在 07:00 到 22:00 之间
- 绝对不要安排凌晨（00:00-06:59）的日程，这是休息时间
- 如果一天内任务太多无法安排完，应该分配到接下来的几天
- 每天建议最多安排4-6个学习/工作日程，保证休息时间

请以JSON格式返回，格式如下:
{
  "schedules": [
    {
      "title": "日程标题",
      "description": "详细描述（可选）",
      "startTime": "ISO时间格式，如2024-01-15T14:00:00.000Z",
      "endTime": "ISO时间格式",
      "priority": "low/medium/high/urgent",
      "location": "地点（可选）",
      "reason": "为什么把这个任务安排在这个时间段的理由（必填，要具体说明考虑因素）"
    }
  ],
  "summary": "对生成的日程安排的简要说明"
}

**关于reason字段的要求**：
- 每个日程都必须有reason字段
- 理由要具体，说明为什么选择这个时间段
- 可以包含：与其他任务的关系、效率考虑、休息安排等

注意：
- 时间必须是有效的ISO 8601格式，使用UTC时间
- 确保 endTime 晚于 startTime
- 日程不要安排在过去的时间
- **再次强调：不要安排凌晨时间（0点-7点）的日程！**
- 只返回JSON，不要其他内容`;

    try {
      const completion = await openaiClient.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const aiResponse = completion.choices[0]?.message?.content || '';
      
      console.log('=== generateSchedulePlan AI响应 ===');
      console.log('响应长度:', aiResponse.length);
      
      interface PlanResult {
        schedules?: GeneratedScheduleItem[];
        summary?: string;
      }

      const { data: result, parsed } = this.safeParseJSON<PlanResult>(aiResponse, {});
      
      if (parsed && result.schedules && result.schedules.length > 0) {
        // 验证和修正日程数据
        const validatedSchedules = result.schedules
          .filter(s => {
            if (!s.title || !s.startTime || !s.endTime) return false;
            
            // 检查时间是否在合理范围内（07:00-22:00）
            try {
              const startDate = new Date(s.startTime);
              const endDate = new Date(s.endTime);
              const startHour = startDate.getUTCHours() + 8; // 转换为北京时间
              const endHour = endDate.getUTCHours() + 8;
              
              // 过滤掉凌晨时间的日程（0-7点）
              if (startHour < 7 || startHour >= 24 || (startHour >= 0 && startHour < 7)) {
                console.log(`过滤不合理时间日程: ${s.title}, 开始时间: ${startHour}:00`);
                return false;
              }
              // 过滤掉太晚结束的日程（23点以后）
              if (endHour > 23 || (endHour >= 0 && endHour < 7)) {
                console.log(`过滤不合理时间日程: ${s.title}, 结束时间: ${endHour}:00`);
                return false;
              }
            } catch (e) {
              return false;
            }
            
            return true;
          })
          .map(s => ({
            title: s.title,
            description: s.description || '',
            startTime: s.startTime,
            endTime: s.endTime,
            priority: (['low', 'medium', 'high', 'urgent'].includes(s.priority) ? s.priority : 'medium') as 'low' | 'medium' | 'high' | 'urgent',
            location: s.location || '',
            reason: s.reason || '根据您的需求智能安排',
          }));

        if (validatedSchedules.length === 0) {
          return {
            success: false,
            error: 'AI生成的日程时间不合理（凌晨时间）或格式无效，请重试',
          };
        }

        // 成功生成后增加使用次数
        const updatedUsage = await this.incrementUsage(userId);

        return {
          success: true,
          schedules: validatedSchedules,
          summary: result.summary || `已生成 ${validatedSchedules.length} 个日程`,
          usage: updatedUsage,
        };
      } else {
        // 尝试从响应中提取可读信息
        const readableText = this.extractReadableText(aiResponse);
        return {
          success: false,
          error: readableText || 'AI无法解析您的描述，请尝试更具体的描述',
        };
      }
    } catch (error: any) {
      console.error('AI规划生成失败:', error);
      
      // 处理常见错误类型
      let errorMessage = 'AI规划失败';
      
      if (error.status === 429 || error.message?.includes('429')) {
        errorMessage = 'AI请求过于频繁，请稍后再试（建议等待1-2分钟）';
      } else if (error.status === 401 || error.message?.includes('401')) {
        errorMessage = 'AI API密钥无效，请检查配置';
      } else if (error.status === 403 || error.message?.includes('403')) {
        errorMessage = 'AI API访问被拒绝，请检查API权限';
      } else if (error.status === 500 || error.message?.includes('500')) {
        errorMessage = 'AI服务暂时不可用，请稍后再试';
      } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('network')) {
        errorMessage = '无法连接到AI服务，请检查网络或API地址';
      } else if (error.message) {
        // 过滤掉HTML标签，只保留文本
        const cleanMessage = error.message.replace(/<[^>]*>/g, '').trim();
        errorMessage = cleanMessage.length > 100 ? cleanMessage.substring(0, 100) + '...' : cleanMessage;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // 批量创建日程
  async batchCreateSchedules(userId: string, schedules: GeneratedScheduleItem[]): Promise<{ success: boolean; created: number; errors: string[] }> {
    const errors: string[] = [];
    let created = 0;

    for (const schedule of schedules) {
      try {
        const startTime = new Date(schedule.startTime);
        const endTime = new Date(schedule.endTime);

        // 验证时间
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          errors.push(`"${schedule.title}": 时间格式无效`);
          continue;
        }

        if (endTime <= startTime) {
          errors.push(`"${schedule.title}": 结束时间必须晚于开始时间`);
          continue;
        }

        await prisma.schedule.create({
          data: {
            title: schedule.title,
            description: schedule.description || '',
            startTime,
            endTime,
            priority: schedule.priority,
            location: schedule.location || '',
            userId,
            status: 'pending',
            isAllDay: false,
          },
        });
        created++;
      } catch (error: any) {
        errors.push(`"${schedule.title}": ${error.message || '创建失败'}`);
      }
    }

    return {
      success: created > 0,
      created,
      errors,
    };
  }

  async optimizeSchedule(userId: string, startDate: Date, endDate: Date) {
    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const optimizations: any[] = [];

    // 简单的优化建议
    schedules.forEach((schedule) => {
      const hour = schedule.startTime.getHours();

      if (schedule.priority === 'high' && hour > 15) {
        optimizations.push({
          scheduleId: schedule.id,
          currentTime: schedule.startTime,
          suggestedTime: new Date(schedule.startTime.setHours(9)),
          reason: '高优先级任务建议在上午完成',
          impact: '提高效率',
        });
      }
    });

    return {
      optimizations,
      overallScore: optimizations.length === 0 ? 0.9 : 0.7,
    };
  }

  // VIP专属：生成周报分析
  async generateWeeklyReport(userId: string): Promise<WeeklyReportData> {
    // 检查VIP状态
    const vipStatus = await this.isUserVip(userId);
    if (!vipStatus.isVip) {
      return {
        success: false,
        error: '周报分析是VIP专属功能，请先升级VIP',
        totalSchedules: 0,
        completedSchedules: 0,
        incompleteSchedules: 0,
        completionRate: 0,
        categoryBreakdown: [],
        dailyStats: [],
        efficiencyScore: 0,
        aiCommentary: '',
        warnings: [],
        recommendations: [],
      };
    }

    const now = new Date();
    // 获取过去7天的日程
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    
    const schedules = await prisma.schedule.findMany({
      where: {
        userId,
        startTime: {
          gte: weekStart,
          lte: now,
        },
      },
      orderBy: { startTime: 'asc' },
    });

    if (schedules.length === 0) {
      return {
        success: true,
        totalSchedules: 0,
        completedSchedules: 0,
        incompleteSchedules: 0,
        completionRate: 0,
        categoryBreakdown: [],
        dailyStats: [],
        efficiencyScore: 0,
        aiCommentary: '本周暂无日程记录。建议开始规划您的日程，让AI帮助您提高效率！',
        warnings: [],
        recommendations: ['开始创建日程，记录您的任务和活动'],
      };
    }

    // 统计基础数据
    const totalSchedules = schedules.length;
    const completedSchedules = schedules.filter(s => s.status === 'completed').length;
    const incompleteSchedules = totalSchedules - completedSchedules;
    const completionRate = Math.round((completedSchedules / totalSchedules) * 100);

    // 按日期统计
    const dailyStatsMap = new Map<string, { completed: number; total: number }>();
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    schedules.forEach(schedule => {
      const dateKey = schedule.startTime.toISOString().split('T')[0];
      if (!dailyStatsMap.has(dateKey)) {
        dailyStatsMap.set(dateKey, { completed: 0, total: 0 });
      }
      const stats = dailyStatsMap.get(dateKey)!;
      stats.total++;
      if (schedule.status === 'completed') {
        stats.completed++;
      }
    });

    const dailyStats: DailyStats[] = Array.from(dailyStatsMap.entries())
      .map(([date, stats]) => ({
        date,
        dayName: dayNames[new Date(date).getDay()],
        completed: stats.completed,
        total: stats.total,
        completionRate: Math.round((stats.completed / stats.total) * 100),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 按分类统计（基于日程标题关键词智能分类）
    const categoryKeywords: { [key: string]: string[] } = {
      '学习': ['学习', '复习', '看书', '阅读', '课程', '培训', '考试', '作业', '研究', '背单词', '刷题', '考证'],
      '工作': ['工作', '会议', '项目', '报告', '开会', '汇报', '加班', '出差', '客户', '面试'],
      '运动健身': ['运动', '健身', '跑步', '游泳', '篮球', '足球', '瑜伽', '锻炼', '散步'],
      '娱乐休闲': ['娱乐', '游戏', '电影', '电视', '休息', '玩', '聚会', '派对', '旅游', '逛街'],
      '社交': ['社交', '朋友', '聚餐', '约会', '饭局', '见面', '拜访'],
      '生活事务': ['购物', '买菜', '做饭', '打扫', '洗衣', '家务', '预约', '取快递'],
      '其他': [],
    };

    const categoryStats: { [key: string]: { count: number; completedCount: number; totalHours: number } } = {};
    Object.keys(categoryKeywords).forEach(cat => {
      categoryStats[cat] = { count: 0, completedCount: 0, totalHours: 0 };
    });

    schedules.forEach(schedule => {
      const title = schedule.title.toLowerCase();
      const description = (schedule.description || '').toLowerCase();
      const text = title + ' ' + description;
      
      let matched = false;
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (category === '其他') continue;
        if (keywords.some(kw => text.includes(kw))) {
          categoryStats[category].count++;
          if (schedule.status === 'completed') {
            categoryStats[category].completedCount++;
          }
          const hours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
          categoryStats[category].totalHours += hours;
          matched = true;
          break;
        }
      }
      if (!matched) {
        categoryStats['其他'].count++;
        if (schedule.status === 'completed') {
          categoryStats['其他'].completedCount++;
        }
        const hours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
        categoryStats['其他'].totalHours += hours;
      }
    });

    const totalHours = Object.values(categoryStats).reduce((sum, stat) => sum + stat.totalHours, 0);
    const categoryBreakdown: CategoryBreakdown[] = Object.entries(categoryStats)
      .filter(([_, stats]) => stats.count > 0)
      .map(([category, stats]) => ({
        category,
        percentage: Math.round((stats.count / totalSchedules) * 100),
        hours: Math.round(stats.totalHours * 10) / 10,
        completedCount: stats.completedCount,
        totalCount: stats.count,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // 计算效率分数 (基于完成率、优先级完成情况、时间利用等)
    let efficiencyScore = completionRate;
    
    // 高优先级任务完成加分
    const highPrioritySchedules = schedules.filter(s => s.priority === 'high' || s.priority === 'urgent');
    const highPriorityCompleted = highPrioritySchedules.filter(s => s.status === 'completed').length;
    if (highPrioritySchedules.length > 0) {
      const highPriorityRate = highPriorityCompleted / highPrioritySchedules.length;
      efficiencyScore = Math.round(efficiencyScore * 0.6 + highPriorityRate * 100 * 0.4);
    }

    // 准备AI分析数据
    const scheduleData = schedules.map(s => ({
      title: s.title,
      description: s.description,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      priority: s.priority,
      status: s.status,
    }));

    // 获取AI客户端
    const { client: openaiClient, model } = await this.getOpenAIClientForUser(userId);
    
    let aiCommentary = '';
    let warnings: string[] = [];
    let recommendations: string[] = [];

    if (openaiClient) {
      const prompt = `你是一个直言不讳的时间管理顾问，请分析用户过去一周的日程安排情况，并给出坦诚、犀利的评价和建议。

用户过去7天的日程数据:
${JSON.stringify(scheduleData, null, 2)}

统计摘要:
- 总日程数: ${totalSchedules}
- 已完成: ${completedSchedules}
- 未完成: ${incompleteSchedules}
- 完成率: ${completionRate}%
- 效率分数: ${efficiencyScore}/100

分类统计:
${categoryBreakdown.map(c => `- ${c.category}: ${c.percentage}% (${c.completedCount}/${c.totalCount}完成, ${c.hours}小时)`).join('\n')}

请以JSON格式返回你的分析:
{
  "commentary": "整体评价（要直白、犀利，指出问题所在，比如'你这周在娱乐上花的时间太多，导致学习任务只完成了一半'这样的风格）",
  "warnings": ["警告1", "警告2"],
  "recommendations": ["具体建议1", "具体建议2", "具体建议3"]
}

要求:
1. commentary要直接点出用户的问题，不要含糊其辞
2. 如果某类任务完成率很低，要明确批评
3. 如果时间分配不合理（如娱乐>>学习），要直接指出
4. warnings是需要立即关注的问题
5. recommendations是具体可执行的改进建议
6. 语气可以严厉，但要有建设性

只返回JSON，不要其他内容。`;

      try {
        const completion = await openaiClient.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
        });

        const aiResponse = completion.choices[0]?.message?.content || '';
        
        interface AICommentaryResult {
          commentary?: string;
          warnings?: string[];
          recommendations?: string[];
        }

        const { data: result, parsed } = this.safeParseJSON<AICommentaryResult>(aiResponse, {});
        
        if (parsed) {
          aiCommentary = result.commentary || '';
          warnings = result.warnings || [];
          recommendations = result.recommendations || [];
        } else {
          // 如果解析失败，使用提取的可读文本
          aiCommentary = this.extractReadableText(aiResponse);
        }
      } catch (error) {
        console.error('AI周报分析失败:', error);
        aiCommentary = this.generateFallbackCommentary(completionRate, categoryBreakdown);
        warnings = this.generateFallbackWarnings(completionRate, categoryBreakdown);
        recommendations = this.generateFallbackRecommendations(completionRate, categoryBreakdown);
      }
    } else {
      // 没有AI配置时使用基础分析
      aiCommentary = this.generateFallbackCommentary(completionRate, categoryBreakdown);
      warnings = this.generateFallbackWarnings(completionRate, categoryBreakdown);
      recommendations = this.generateFallbackRecommendations(completionRate, categoryBreakdown);
    }

    return {
      success: true,
      totalSchedules,
      completedSchedules,
      incompleteSchedules,
      completionRate,
      categoryBreakdown,
      dailyStats,
      efficiencyScore,
      aiCommentary,
      warnings,
      recommendations,
    };
  }

  // 生成备用评价（当AI不可用时）
  private generateFallbackCommentary(completionRate: number, categories: CategoryBreakdown[]): string {
    const parts: string[] = [];
    
    if (completionRate >= 80) {
      parts.push(`本周完成率${completionRate}%，表现不错！继续保持。`);
    } else if (completionRate >= 50) {
      parts.push(`本周完成率${completionRate}%，还有提升空间。`);
    } else {
      parts.push(`本周完成率仅${completionRate}%，需要认真反思时间管理问题。`);
    }

    const topCategory = categories[0];
    if (topCategory) {
      parts.push(`时间主要花在"${topCategory.category}"上，占比${topCategory.percentage}%。`);
    }

    const lowCompletionCategories = categories.filter(c => c.totalCount > 0 && c.completedCount / c.totalCount < 0.5);
    if (lowCompletionCategories.length > 0) {
      parts.push(`"${lowCompletionCategories.map(c => c.category).join('、')}"类任务完成率较低，需要关注。`);
    }

    return parts.join(' ');
  }

  // 生成备用警告
  private generateFallbackWarnings(completionRate: number, categories: CategoryBreakdown[]): string[] {
    const warnings: string[] = [];
    
    if (completionRate < 50) {
      warnings.push('完成率过低，建议减少日程数量，专注于重要任务');
    }

    const learningCategory = categories.find(c => c.category === '学习');
    const entertainmentCategory = categories.find(c => c.category === '娱乐休闲');
    
    if (learningCategory && entertainmentCategory && entertainmentCategory.hours > learningCategory.hours * 2) {
      warnings.push('娱乐时间远超学习时间，请注意时间分配');
    }

    return warnings;
  }

  // 生成备用建议
  private generateFallbackRecommendations(completionRate: number, categories: CategoryBreakdown[]): string[] {
    const recommendations: string[] = [];
    
    if (completionRate < 70) {
      recommendations.push('尝试将大任务拆分成小任务，更容易完成');
      recommendations.push('为每个任务设置具体的截止时间');
    }
    
    recommendations.push('每天早上花5分钟规划当天的重点任务');
    recommendations.push('使用番茄工作法提高专注度');

    return recommendations;
  }

  // 保存周报到数据库
  async saveWeeklyReport(userId: string, reportData: WeeklyReportData): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      // 检查VIP状态
      const vipStatus = await this.isUserVip(userId);
      if (!vipStatus.isVip) {
        return {
          success: false,
          error: '保存周报是VIP专属功能',
        };
      }

      const now = new Date();
      const weekEndDate = new Date(now);
      const weekStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 创建周报记录
      const report = await (prisma as any).weeklyReport.create({
        data: {
          userId,
          weekStartDate,
          weekEndDate,
          totalSchedules: reportData.totalSchedules,
          completedSchedules: reportData.completedSchedules,
          incompleteSchedules: reportData.incompleteSchedules,
          completionRate: reportData.completionRate,
          efficiencyScore: reportData.efficiencyScore,
          categoryBreakdown: JSON.stringify(reportData.categoryBreakdown),
          dailyStats: JSON.stringify(reportData.dailyStats),
          aiCommentary: reportData.aiCommentary,
          warnings: JSON.stringify(reportData.warnings),
          recommendations: JSON.stringify(reportData.recommendations),
        },
      });

      return {
        success: true,
        reportId: report.id,
      };
    } catch (error: any) {
      console.error('保存周报失败:', error);
      return {
        success: false,
        error: error.message || '保存周报失败',
      };
    }
  }

  // 获取用户的周报历史列表
  async getWeeklyReportHistory(userId: string, limit: number = 10): Promise<{
    success: boolean;
    reports?: Array<{
      id: string;
      weekStartDate: string;
      weekEndDate: string;
      completionRate: number;
      efficiencyScore: number;
      createdAt: string;
    }>;
    error?: string
  }> {
    try {
      // 检查VIP状态
      const vipStatus = await this.isUserVip(userId);
      if (!vipStatus.isVip) {
        return {
          success: false,
          error: '查看周报历史是VIP专属功能',
        };
      }

      const reports = await (prisma as any).weeklyReport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          weekStartDate: true,
          weekEndDate: true,
          completionRate: true,
          efficiencyScore: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        reports: reports.map((r: any) => ({
          id: r.id,
          weekStartDate: r.weekStartDate.toISOString(),
          weekEndDate: r.weekEndDate.toISOString(),
          completionRate: r.completionRate,
          efficiencyScore: r.efficiencyScore,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      console.error('获取周报历史失败:', error);
      return {
        success: false,
        error: error.message || '获取周报历史失败',
      };
    }
  }

  // 获取周报详情
  async getWeeklyReportDetail(userId: string, reportId: string): Promise<WeeklyReportData & { id?: string; createdAt?: string }> {
    try {
      // 检查VIP状态
      const vipStatus = await this.isUserVip(userId);
      if (!vipStatus.isVip) {
        return {
          success: false,
          error: '查看周报详情是VIP专属功能',
          totalSchedules: 0,
          completedSchedules: 0,
          incompleteSchedules: 0,
          completionRate: 0,
          categoryBreakdown: [],
          dailyStats: [],
          efficiencyScore: 0,
          aiCommentary: '',
          warnings: [],
          recommendations: [],
        };
      }

      const report = await (prisma as any).weeklyReport.findFirst({
        where: {
          id: reportId,
          userId,
        },
      });

      if (!report) {
        return {
          success: false,
          error: '周报不存在或无权访问',
          totalSchedules: 0,
          completedSchedules: 0,
          incompleteSchedules: 0,
          completionRate: 0,
          categoryBreakdown: [],
          dailyStats: [],
          efficiencyScore: 0,
          aiCommentary: '',
          warnings: [],
          recommendations: [],
        };
      }

      return {
        success: true,
        id: report.id,
        createdAt: report.createdAt.toISOString(),
        totalSchedules: report.totalSchedules,
        completedSchedules: report.completedSchedules,
        incompleteSchedules: report.incompleteSchedules,
        completionRate: report.completionRate,
        categoryBreakdown: JSON.parse(report.categoryBreakdown),
        dailyStats: JSON.parse(report.dailyStats),
        efficiencyScore: report.efficiencyScore,
        aiCommentary: report.aiCommentary,
        warnings: JSON.parse(report.warnings),
        recommendations: JSON.parse(report.recommendations),
      };
    } catch (error: any) {
      console.error('获取周报详情失败:', error);
      return {
        success: false,
        error: error.message || '获取周报详情失败',
        totalSchedules: 0,
        completedSchedules: 0,
        incompleteSchedules: 0,
        completionRate: 0,
        categoryBreakdown: [],
        dailyStats: [],
        efficiencyScore: 0,
        aiCommentary: '',
        warnings: [],
        recommendations: [],
      };
    }
  }
}

export default new AIService();