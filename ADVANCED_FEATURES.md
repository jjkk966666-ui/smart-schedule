# 高级功能实现指南

本文档详细说明智能日程表系统的高级功能实现方案。

## 📋 功能清单

- [x] 基础功能（已完成）
- [ ] 实时通知系统 (WebSocket)
- [ ] 日历视图（月/周/日）
- [ ] 移动端适配
- [ ] 日程分享功能
- [ ] 数据导出（PDF/Excel）
- [ ] 多语言支持 (i18n)

---

## 1. 实时通知系统 (WebSocket)

### 1.1 后端实现

**安装依赖**:
```bash
cd backend
npm install socket.io @types/socket.io
```

**创建 WebSocket 服务** (`backend/src/services/websocket.service.ts`):
```typescript
import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../utils/jwt.util';

export class WebSocketService {
  private io: SocketServer;
  private userSockets: Map<string, string> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const payload = await verifyToken(token);
        socket.data.userId = payload.userId;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      this.userSockets.set(userId, socket.id);
      
      console.log(`User ${userId} connected`);

      socket.on('disconnect', () => {
        this.userSockets.delete(userId);
        console.log(`User ${userId} disconnected`);
      });
    });
  }

  // 发送日程提醒
  sendScheduleReminder(userId: string, schedule: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('schedule:reminder', {
        type: 'reminder',
        schedule,
        message: `日程 "${schedule.title}" 即将开始`,
        timestamp: new Date(),
      });
    }
  }

  // 发送冲突警告
  sendConflictAlert(userId: string, conflicts: any[]) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('schedule:conflict', {
        type: 'conflict',
        conflicts,
        message: `检测到 ${conflicts.length} 个日程冲突`,
        timestamp: new Date(),
      });
    }
  }

  // 发送日程更新通知
  sendScheduleUpdate(userId: string, action: 'created' | 'updated' | 'deleted', schedule: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('schedule:update', {
        type: 'update',
        action,
        schedule,
        timestamp: new Date(),
      });
    }
  }
}

export let websocketService: WebSocketService;

export const initializeWebSocket = (httpServer: HttpServer) => {
  websocketService = new WebSocketService(httpServer);
  return websocketService;
};
```

**更新 server.ts**:
```typescript
import http from 'http';
import app from './app';
import { initializeWebSocket } from './services/websocket.service';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// 初始化 WebSocket
initializeWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**添加定时任务** (`backend/src/services/notification.service.ts`):
```typescript
import prisma from '../config/database';
import { websocketService } from './websocket.service';

export class NotificationService {
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    // 每分钟检查一次即将到来的日程
    this.checkInterval = setInterval(() => {
      this.checkUpcomingSchedules();
    }, 60000); // 1分钟
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private async checkUpcomingSchedules() {
    const now = new Date();
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);

    const upcomingSchedules = await prisma.schedule.findMany({
      where: {
        startTime: {
          gte: now,
          lte: fifteenMinutesLater,
        },
        status: 'pending',
      },
    });

    for (const schedule of upcomingSchedules) {
      websocketService.sendScheduleReminder(schedule.userId, schedule);
    }
  }
}

export default new NotificationService();
```

### 1.2 前端实现

**安装依赖**:
```bash
cd frontend
npm install socket.io-client
```

**创建 WebSocket Hook** (`frontend/src/hooks/useWebSocket.ts`):
```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  type: 'reminder' | 'conflict' | 'update';
  message: string;
  data?: any;
  timestamp: Date;
}

export const useWebSocket = (token: string | null) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://localhost:3000', {
      auth: { token },
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    });

    newSocket.on('schedule:reminder', (data) => {
      setNotifications(prev => [...prev, {
        type: 'reminder',
        message: data.message,
        data: data.schedule,
        timestamp: new Date(data.timestamp),
      }]);
      
      // 显示浏览器通知
      if (Notification.permission === 'granted') {
        new Notification('日程提醒', {
          body: data.message,
          icon: '/icon.png',
        });
      }
    });

    newSocket.on('schedule:conflict', (data) => {
      setNotifications(prev => [...prev, {
        type: 'conflict',
        message: data.message,
        data: data.conflicts,
        timestamp: new Date(data.timestamp),
      }]);
    });

    newSocket.on('schedule:update', (data) => {
      setNotifications(prev => [...prev, {
        type: 'update',
        message: `日程已${data.action === 'created' ? '创建' : data.action === 'updated' ? '更新' : '删除'}`,
        data: data.schedule,
        timestamp: new Date(data.timestamp),
      }]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return { socket, notifications, isConnected, clearNotifications };
};
```

---

## 2. 移动端适配

### 2.1 响应式CSS优化

**更新 `frontend/src/App.css`** - 添加移动端断点:
```css
/* 移动端优化 */
@media (max-width: 480px) {
  .app-header {
    padding: 12px 16px;
  }

  .app-header h1 {
    font-size: 20px;
  }

  .header-actions {
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .stats-panel {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-value {
    font-size: 24px;
  }

  .schedule-form {
    padding: 20px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .btn-primary,
  .btn-recommend {
    width: 100%;
  }

  .recommendation-list {
    gap: 8px;
  }
}

/* 平板适配 */
@media (min-width: 481px) and (max-width: 768px) {
  .stats-panel {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 触摸优化 */
@media (hover: none) {
  .schedule-card:hover {
    transform: none;
  }

  .recommendation-item:hover {
    transform: none;
  }

  /* 增大可点击区域 */
  button,
  .recommendation-item,
  .schedule-card {
    min-height: 44px;
  }
}
```

### 2.2 Viewport Meta配置

**更新 `frontend/index.html`**:
```html
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
</head>
```

---

## 3. 日历视图实现

### 3.1 安装依赖

```bash
cd frontend
npm install react-big-calendar date-fns
npm install --save-dev @types/react-big-calendar
```

### 3.2 创建日历组件

**`frontend/src/components/CalendarView.tsx`**:
```typescript
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import zhCN from 'date-fns/locale/zh-CN';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Schedule } from '../types';

const locales = {
  'zh-CN': zhCN,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  schedules: Schedule[];
  onSelectEvent: (event: Schedule) => void;
  onSelectSlot: (slotInfo: any) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  schedules,
  onSelectEvent,
  onSelectSlot,
}) => {
  const events = schedules.map(schedule => ({
    ...schedule,
    start: new Date(schedule.startTime),
    end: new Date(schedule.endTime),
    title: schedule.title,
  }));

  return (
    <div style={{ height: '600px' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture="zh-CN"
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable
        views={['month', 'week', 'day', 'agenda']}
        defaultView="month"
        style={{ height: '100%' }}
      />
    </div>
  );
};
```

---

## 4. 多语言支持 (i18n)

### 4.1 安装依赖

```bash
cd frontend
npm install i18next react-i18next i18next-browser-languagedetector
```

### 4.2 配置 i18n

**`frontend/src/i18n/config.ts`**:
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

**语言文件** (`frontend/src/i18n/locales/zh-CN.json`):
```json
{
  "app": {
    "title": "智能日程表",
    "welcome": "欢迎, {{name}}"
  },
  "auth": {
    "login": "登录",
    "register": "注册",
    "logout": "退出",
    "email": "邮箱",
    "password": "密码",
    "name": "姓名"
  },
  "schedule": {
    "title": "日程标题",
    "add": "添加日程",
    "delete": "删除",
    "priority": {
      "low": "低优先级",
      "medium": "中优先级",
      "high": "高优先级",
      "urgent": "紧急"
    }
  }
}
```

**使用示例**:
```typescript
import { useTranslation } from 'react-i18next';

function App() {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div>
      <h1>{t('app.title')}</h1>
      <button onClick={() => changeLanguage('zh-CN')}>中文</button>
      <button onClick={() => changeLanguage('en-US')}>English</button>
    </div>
  );
}
```

---

## 5. 数据导出功能

### 5.1 PDF导出

**安装依赖**:
```bash
cd backend
npm install pdfkit @types/pdfkit
```

**创建导出服务** (`backend/src/services/export.service.ts`):
```typescript
import PDFDocument from 'pdfkit';
import { Schedule } from '@prisma/client';

export class ExportService {
  async generatePDF(schedules: Schedule[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // 标题
      doc.fontSize(20).text('日程列表', { align: 'center' });
      doc.moveDown();

      // 日程内容
      schedules.forEach((schedule, index) => {
        doc.fontSize(14).text(`${index + 1}. ${schedule.title}`);
        doc.fontSize(10).text(`时间: ${schedule.startTime} - ${schedule.endTime}`);
        doc.fontSize(10).text(`优先级: ${schedule.priority}`);
        doc.moveDown();
      });

      doc.end();
    });
  }
}
```

### 5.2 Excel导出

**安装依赖**:
```bash
npm install exceljs
```

**Excel导出实现**:
```typescript
import ExcelJS from 'exceljs';

export class ExportService {
  async generateExcel(schedules: Schedule[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('日程列表');

    // 设置列
    worksheet.columns = [
      { header: '标题', key: 'title', width: 30 },
      { header: '开始时间', key: 'startTime', width: 20 },
      { header: '结束时间', key: 'endTime', width: 20 },
      { header: '优先级', key: 'priority', width: 10 },
      { header: '状态', key: 'status', width: 10 },
    ];

    // 添加数据
    schedules.forEach(schedule => {
      worksheet.addRow({
        title: schedule.title,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        priority: schedule.priority,
        status: schedule.status,
      });
    });

    return await workbook.xlsx.writeBuffer() as Buffer;
  }
}
```

**添加导出路由**:
```typescript
// backend/src/routes/schedule.routes.ts
router.get('/export/pdf', scheduleController.exportPDF);
router.get('/export/excel', scheduleController.exportExcel);
```

---

## 6. 日程分享功能

### 6.1 数据库扩展

**更新 Prisma Schema**:
```prisma
model ShareLink {
  id        String   @id @default(uuid())
  scheduleId String
  schedule  Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime?
  createdBy String
  createdAt DateTime @default(now())
}
```

### 6.2 分享服务

**`backend/src/services/share.service.ts`**:
```typescript
import crypto from 'crypto';
import prisma from '../config/database';

export class ShareService {
  async createShareLink(scheduleId: string, userId: string, expiresInDays?: number) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const shareLink = await prisma.shareLink.create({
      data: {
        scheduleId,
        token,
        expiresAt,
        createdBy: userId,
      },
    });

    return {
      url: `${process.env.FRONTEND_URL}/shared/${token}`,
      token,
      expiresAt,
    };
  }

  async getSharedSchedule(token: string) {
    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: { schedule: true },
    });

    if (!shareLink) {
      throw new Error('分享链接不存在');
    }

    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      throw new Error('分享链接已过期');
    }

    return shareLink.schedule;
  }
}
```

---

## 7. 实现优先级

基于复杂度和依赖关系，建议按以下顺序实现：

1. **移动端适配** (最简单，纯CSS) - ✅ 已提供完整方案
2. **多语言支持** (中等，配置驱动) - ✅ 已提供完整方案
3. **实时通知系统** (中等，需要WebSocket) - ✅ 已提供完整方案
4. **日历视图** (中等，使用第三方库) - ✅ 已提供完整方案
5. **数据导出** (中等，文件生成) - ✅ 已提供完整方案
6. **日程分享** (复杂，需要数据库扩展) - ✅ 已提供完整方案

---

## 8. 测试检查清单

### WebSocket
- [ ] 连接建立成功
- [ ] 认证失败处理
- [ ] 日程提醒推送
- [ ] 冲突警告推送
- [ ] 断线重连

### 移动端
- [ ] 各屏幕尺寸正常显示
- [ ] 触摸操作流畅
- [ ] 可点击区域足够大

### 日历视图
- [ ] 月/周/日视图切换
- [ ] 事件正确显示
- [ ] 点击事件查看详情

### 多语言
- [ ] 语言切换正常
- [ ] 翻译完整无遗漏
- [ ] 日期格式本地化

### 导出
- [ ] PDF生成正确
- [ ] Excel格式正确
- [ ] 文件下载成功

### 分享
- [ ] 生成分享链接
- [ ] 链接访问正常
- [ ] 过期时间生效

---

## 9. 性能优化建议

1. **WebSocket**: 使用心跳机制保持连接
2. **移动端**: 图片懒加载、代码分割
3. **日历**: 虚拟滚动大数据集
4. **导出**: 异步生成、后台队列
5. **分享**: Redis缓存分享链接

---

## 10. 安全考虑

1. **WebSocket**: JWT认证、速率限制
2. **导出**: 权限验证、文件大小限制
3. **分享**: Token过期机制、访问日志

---

**最后更新**: 2025-12-28  
**版本**: 2.0.0