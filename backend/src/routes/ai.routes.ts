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
// VIP专属：保存周报
router.post('/weekly-report/save', aiController.saveWeeklyReport);
// VIP专属：获取周报历史列表
router.get('/weekly-report/history', aiController.getWeeklyReportHistory);
// VIP专属：获取周报详情
router.get('/weekly-report/:reportId', aiController.getWeeklyReportDetail);
// VIP专属：删除周报
router.delete('/weekly-report/:reportId', aiController.deleteWeeklyReport);

export default router;
