import OpenAI from 'openai';
import { openai as defaultOpenai, openaiConfig } from '../config/openai';
import prisma from '../config/database';

// 临时类型定义：扩展User类型以包含AI配置字段
// 注意：运行 `npx prisma generate` 后可以移除此接口
interface UserWithAIConfig {
  aiApiKey: string | null;
  aiApiBaseUrl: string | null;
  aiModel?: string | null;
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

export class AIService {
  // 清理AI响应，移除思考标签和提取JSON
  private cleanAIResponse(response: string): string {
    let cleaned = response;
    
    console.log('=== 原始AI响应 ===');
    console.log(response.substring(0, 500));
    console.log('=== 原始响应结束 ===');
    
    // 移除 <think>...</think> 标签及其内容
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
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
    
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
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
    
    console.log('=== 清理后的JSON ===');
    console.log(cleaned.substring(0, 500));
    console.log('=== 清理后结束 ===');
    
    return cleaned.trim();
  }

  // 安全解析JSON，带有更好的错误处理
  private safeParseJSON<T>(response: string, fallback: T): { data: T; parsed: boolean; rawResponse: string } {
    try {
      const cleaned = this.cleanAIResponse(response);
      const data = JSON.parse(cleaned) as T;
      console.log('=== JSON解析成功 ===');
      console.log('解析结果:', JSON.stringify(data, null, 2).substring(0, 500));
      return { data, parsed: true, rawResponse: response };
    } catch (error) {
      console.log('=== JSON解析失败 ===');
      console.log('错误:', error);
      console.log('原始响应前500字符:', response.substring(0, 500));
      return { data: fallback, parsed: false, rawResponse: response };
    }
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
    
    // 移除 <think>...</think> 标签及其内容
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // 尝试先解析JSON并提取有意义的内容
    try {
      const cleaned = this.cleanAIResponse(response);
      const jsonData = JSON.parse(cleaned);
      const extracted = this.extractAnalysisFromResult(jsonData);
      if (extracted && extracted.length > 20) {
        return extracted;
      }
    } catch (e) {
      // 解析失败，继续使用文本提取
    }
    
    // 移除代码块（包括内容）
    text = text.replace(/```[\s\S]*?```/g, '');
    
    // 不要移除整个JSON对象，而是尝试提取其中的文本值
    // 尝试提取JSON中的文本字段
    const textFields = [
      /"overallAnalysis"\s*:\s*"([^"]+)"/,
      /"coordination"\s*:\s*"([^"]+)"/,
      /"priorityReason"\s*:\s*"([^"]+)"/,
      /"generalAdvice"\s*:\s*"([^"]+)"/,
      /"reason"\s*:\s*"([^"]+)"/,
    ];
    
    const extractedTexts: string[] = [];
    for (const regex of textFields) {
      const match = response.match(regex);
      if (match && match[1]) {
        extractedTexts.push(match[1]);
      }
    }
    
    if (extractedTexts.length > 0) {
      return extractedTexts.join('\n\n');
    }
    
    // 移除JSON对象
    text = text.replace(/\{[\s\S]*?\}/g, '');
    
    // 移除常见的AI响应前缀
    text = text.replace(/^(好的|明白|以下是|根据你的要求|这是).*/gm, '');
    
    // 清理多余空白
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    // 如果清理后没有有效文本，尝试提取原始响应中的第一段文本
    if (!text || text.length < 10) {
      const lines = response.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 20 &&
               !trimmed.startsWith('{') &&
               !trimmed.startsWith('}') &&
               !trimmed.startsWith('[') &&
               !trimmed.startsWith(']') &&
               !trimmed.startsWith('```') &&
               !trimmed.startsWith('"');
      });
      
      if (lines.length > 0) {
        return lines.slice(0, 5).join('\n');
      }
      
      return 'AI分析已完成，但响应格式无法解析。请检查AI模型是否正确返回JSON格式。';
    }
    
    return text;
  }

  // 获取OpenAI客户端（仅使用系统级配置）
  private getOpenAIClient(): OpenAI | null {
    // 使用系统默认配置
    if (process.env.OPENAI_API_KEY) {
      return defaultOpenai;
    }
    return null;
  }

  // 获取AI模型配置（仅使用系统级配置）
  private getAIModel(): string {
    return openaiConfig.model;
  }

  // 检查系统是否配置了AI
  async hasAIConfig(): Promise<boolean> {
    return process.env.OPENAI_API_KEY !== undefined;
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
  async generateSchedulePlan(userId: string, description: string): Promise<GeneratePlanResult> {
    const now = new Date();
    
    const openaiClient = this.getOpenAIClient();
    if (!openaiClient) {
      return {
        success: false,
        error: 'AI服务未配置，请联系管理员',
      };
    }

    const model = this.getAIModel();
    
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

        return {
          success: true,
          schedules: validatedSchedules,
          summary: result.summary || `已生成 ${validatedSchedules.length} 个日程`,
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
}

export default new AIService();