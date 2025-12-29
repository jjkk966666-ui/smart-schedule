import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import scheduleRoutes from './routes/schedule.routes';
import tagRoutes from './routes/tag.routes';
import aiRoutes from './routes/ai.routes';
import { errorHandler } from './middlewares/error.middleware';

dotenv.config();

const app = express();

// 中间件
app.use(helmet());

// CORS 配置 - 支持多个来源和动态来源
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // 允许的来源列表
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
    ];
    
    // 从环境变量添加额外的来源
    if (process.env.CORS_ORIGIN) {
      allowedOrigins.push(...process.env.CORS_ORIGIN.split(',').map(s => s.trim()));
    }
    
    // 如果没有 origin（如服务器端请求）或者 origin 在允许列表中，或者是 devtunnels 域名
    if (!origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.devtunnels.ms') ||
        origin.endsWith('.github.dev') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // 在开发阶段暂时允许所有来源，方便调试
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/ai', aiRoutes);

// 错误处理
app.use(errorHandler);

export default app;