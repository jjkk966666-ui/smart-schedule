import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import tagService from '../services/tag.service';

export class TagController {
  async createTag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tag = await tagService.createTag(req.body);
      res.status(201).json({
        success: true,
        data: tag,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tags = await tagService.getTags();
      res.json({
        success: true,
        data: tags,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tag = await tagService.updateTag(req.params.id, req.body);
      res.json({
        success: true,
        data: tag,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteTag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await tagService.deleteTag(req.params.id);
      res.json({
        success: true,
        message: 'Tag deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new TagController();