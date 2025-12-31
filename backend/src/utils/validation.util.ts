import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const createScheduleSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow('', null),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  location: Joi.string().allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').default('pending'),
  isAllDay: Joi.boolean().default(false),
  recurrenceRule: Joi.string().allow('', null),
  tagIds: Joi.array().items(Joi.string()),
});

export const updateScheduleSchema = Joi.object({
  id: Joi.string(), // 允许id字段（虽然已在URL中，前端可能仍会传递）
  title: Joi.string(),
  description: Joi.string().allow('', null),
  startTime: Joi.date().iso(),
  endTime: Joi.date().iso(),
  location: Joi.string().allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled'),
  isAllDay: Joi.boolean(),
  recurrenceRule: Joi.string().allow('', null),
  tagIds: Joi.array().items(Joi.string()),
});

export const createTagSchema = Joi.object({
  name: Joi.string().required(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required(),
});