import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { AppError } from '../types';

export const validate = (schema: Schema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', details);
    }

    next();
  };
};