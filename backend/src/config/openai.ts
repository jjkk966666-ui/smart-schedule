import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// 普通用户的OpenAI配置
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

export const openaiConfig = {
  model: process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 2000,
};

// VIP用户的Premium API配置
export const premiumOpenai = process.env.PREMIUM_API_KEY
  ? new OpenAI({
      apiKey: process.env.PREMIUM_API_KEY,
      baseURL: process.env.PREMIUM_BASE_URL || undefined,
    })
  : null;

export const premiumConfig = {
  model: process.env.PREMIUM_MODEL_NAME || 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 2000,
};

// VIP使用限制配置
export const usageLimits = {
  normal: 5,  // 普通用户每日5次
  vip: 10,    // VIP用户每日10次
};