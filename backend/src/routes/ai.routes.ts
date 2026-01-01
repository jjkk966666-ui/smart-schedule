import { Router } from 'express';
import aiController from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/analyze-conflicts', aiController.analyzeConflicts);
router.post('/suggest-time', aiController.suggestTime);
router.post('/optimize-schedule', aiController.optimizeSchedule);
router.post('/analyze-planning', aiController.analyzePlanning);
// VIP专属：周报分析
router.get('/weekly-report', aiController.weeklyReport);

export default router;