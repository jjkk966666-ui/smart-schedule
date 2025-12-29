import { Router } from 'express';
import tagController from '../controllers/tag.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createTagSchema } from '../utils/validation.util';

const router = Router();

router.use(authenticate);

router.post('/', validate(createTagSchema), tagController.createTag);
router.get('/', tagController.getTags);
router.put('/:id', tagController.updateTag);
router.delete('/:id', tagController.deleteTag);

export default router;