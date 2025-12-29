import { Router } from 'express';
import scheduleController from '../controllers/schedule.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createScheduleSchema, updateScheduleSchema } from '../utils/validation.util';

const router = Router();

router.use(authenticate);

router.post('/', validate(createScheduleSchema), scheduleController.createSchedule);
router.get('/', scheduleController.getSchedules);
router.get('/calendar', scheduleController.getCalendarView);
router.get('/conflicts/check', scheduleController.checkConflicts);
router.get('/stats', scheduleController.getStats);

// 智能科学规划路由 - 必须在 /:id 之前
router.post('/generate-plan', scheduleController.generatePlan);
router.post('/save-plan', scheduleController.savePlan);

// 规划历史路由 - 必须在 /:id 之前
router.get('/planning-history', scheduleController.getPlanningHistory);
router.delete('/planning-history/:historyId', scheduleController.deletePlanningHistory);

// 带参数的路由放在最后
router.get('/:id', scheduleController.getScheduleById);
router.put('/:id', validate(updateScheduleSchema), scheduleController.updateSchedule);
router.delete('/:id', scheduleController.deleteSchedule);

// AI建议相关路由
router.get('/:id/ai-suggestions', scheduleController.getAISuggestions);
router.post('/:id/ai-suggestions', scheduleController.saveAISuggestion);

export default router;