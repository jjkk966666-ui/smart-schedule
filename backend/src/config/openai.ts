import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openaiConfig = {
  model: process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 2000,
};