import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { registerSchema, loginSchema } from '../utils/validation.util';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);

// VIP通行证兑换
router.post('/redeem', authenticate, authController.redeemVipPassport);

// 生成VIP通行证（仅管理员）
router.post('/generate-passport', authenticate, authController.generateVipPassport);

export default router;