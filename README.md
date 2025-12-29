# 智能日程表管理系统 (Smart Schedule Manager)

一个功能完整的全栈智能日程表应用，支持多用户管理日程、AI智能分析、时间冲突检测和智能推荐。

## 🌟 核心功能

### ✅ 已实现功能

- **用户认证与授权**
  - 用户注册、登录
  - JWT令牌认证（Access Token + Refresh Token）
  - Token自动刷新机制
  - 用户信息管理

- **日程管理**
  - 创建、查看、删除日程
  - 优先级设置（低、中、高、紧急）
  - 状态管理（待处理、进行中、已完成、已取消）
  - 时间范围筛选
  - 分页查询

- **智能冲突检测**
  - 实时时间冲突检测
  - 可视化冲突警告
  - 冲突详情展示
  - 确认后仍可添加

- **日程统计**
  - 总日程数量
  - 今日日程
  - 本周日程
  - 待完成日程
  - 高优先级日程

- **AI智能推荐** (集成OpenAI)
  - 智能时间段推荐
  - 空闲时间分析
  - 冲突分析建议
  - 日程优化建议

- **用户体验**
  - 响应式设计
  - 现代化UI界面
  - 渐变色彩方案
  - 流畅的交互动画

### 🚧 待实现功能

- 实时通知系统
- 日历视图（月视图、周视图）
- 日程分享功能
- 导出日程数据

## 🛠️ 技术栈

### 前端
- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Axios** - HTTP 客户端
- **CSS3** - 样式设计（渐变、动画）

### 后端
- **Node.js** - 运行时环境
- **Express.js** - Web 框架
- **TypeScript** - 类型安全
- **Prisma ORM** - 数据库 ORM
- **SQLite** - 数据库（开发环境）
- **JWT** - 身份认证
- **OpenAI API** - AI 功能
- **bcrypt** - 密码加密

## 📁 项目结构

```
smart-schedule-manager/
├── frontend/           # React前端应用
├── backend/            # Express后端API
├── plans/              # 架构设计文档
├── README.md
└── .gitignore
```

## 🚀 快速开始

### 环境要求

- Node.js 18 或更高版本
- PostgreSQL 14 或更高版本
- npm 或 pnpm

### 1. 克隆项目

```bash
git clone <repository-url>
cd smart-schedule-manager
```

### 2. 安装依赖

#### 前端
```bash
cd frontend
npm install
```

#### 后端
```bash
cd backend
npm install
```

### 3. 配置环境变量

#### 后端 `.env` 文件
```env
# 数据库 (SQLite)
DATABASE_URL="file:./prisma/dev.db"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI (可选 - 用于AI增强功能)
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7

# 服务器
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173
```

#### 前端 `.env` 文件
```env
VITE_API_URL=http://localhost:3000
```

### 4. 数据库设置

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 5. 启动开发服务器

#### 后端 (终端1)
```bash
cd backend
npm run dev
```

#### 前端 (终端2)
```bash
cd frontend
npm run dev
```

前端应用将在 `http://localhost:5173` 运行  
后端API将在 `http://localhost:3000` 运行

## 📚 文档

- [架构设计文档](./plans/architecture.md)
- [项目结构文档](./plans/project-structure.md)
- [API 接口文档](./API_DOCUMENTATION.md)
- [快速入门指南](./GETTING_STARTED.md)

## 📸 功能截图

### 用户认证
- 登录/注册界面
- 现代化设计

### 日程管理
- 日程列表展示
- 优先级颜色标识
- 冲突警告提示

### AI智能推荐
- 智能时间推荐
- 推荐理由说明
- 一键应用时间

### 统计面板
- 可视化数据展示
- 渐变色彩卡片
- 实时数据更新

## 🧪 API 测试

### 使用 cURL 测试

**1. 注册用户**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"测试用户"}'
```

**2. 登录**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**3. 创建日程** (需要替换 YOUR_TOKEN)
```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title":"团队会议",
    "startTime":"2025-12-28T10:00:00.000Z",
    "endTime":"2025-12-28T11:00:00.000Z",
    "priority":"high"
  }'
```

**4. 获取AI时间推荐**
```bash
curl -X POST http://localhost:3000/api/ai/suggest-time \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"duration":60}'
```

详细API测试示例请参考 [API文档](./API_DOCUMENTATION.md)

## 📦 生产部署

### 🚀 推荐方案：Vercel (前端) + Render (后端)

本项目已配置完整的生产环境部署方案，支持一键部署到 Vercel 和 Render，实现永久在线访问。

#### 快速部署步骤

1. **准备代码仓库**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **部署后端到 Render**
   - 创建 PostgreSQL 数据库
   - 部署 Web Service（自动检测 `backend/render.yaml`）
   - 配置环境变量
   - 运行数据库迁移

3. **部署前端到 Vercel**
   - 导入 GitHub 仓库
   - 自动检测 Vite 配置（`frontend/vercel.json`）
   - 设置后端 API URL
   - 一键部署

#### 详细部署文档

- **📖 [完整部署指南](./PRODUCTION_DEPLOYMENT.md)** - 详细的分步教程
- **✅ [部署检查清单](./DEPLOYMENT_CHECKLIST.md)** - 确保不遗漏任何步骤

#### 部署配置文件

项目已包含以下生产环境配置：
- `frontend/vercel.json` - Vercel 部署配置
- `backend/render.yaml` - Render Blueprint 配置
- `backend/prisma/schema.prisma` - PostgreSQL 数据库配置

### 💰 成本估算

- **免费方案**：Vercel 免费 + Render 免费 = $0/月（后端会休眠）
- **推荐方案**：Vercel 免费 + Render $7/月 = $7/月（24/7 在线）

## 📦 本地生产构建

### 前端
```bash
cd frontend
npm run build
# 构建产物在 dist/ 目录
```

### 后端
```bash
cd backend
npm run build
# 构建产物在 dist/ 目录
```

## 🎯 项目特色

1. **全栈TypeScript** - 前后端统一使用 TypeScript，类型安全
2. **现代化UI** - 渐变色彩、流畅动画、响应式设计
3. **智能AI集成** - OpenAI 驱动的智能推荐和优化
4. **实时冲突检测** - 表单输入时即时检测时间冲突
5. **完整的认证系统** - JWT + Refresh Token 双令牌机制
6. **数据统计可视化** - 实时展示日程统计信息
7. **RESTful API** - 规范的 API 设计，完整的文档

## 🔒 安全性

- 密码使用 bcrypt 加密存储
- JWT 令牌认证
- CORS 跨域保护
- SQL 注入防护 (Prisma ORM)
- XSS 防护 (React 默认保护)
- 环境变量隔离

## 📈 性能优化

- Vite 快速构建
- React 组件懒加载
- 数据库索引优化
- API 响应缓存
- 分页查询减少负载

## 🐛 常见问题

**Q: 如何配置 OpenAI API？**
A: 在 `backend/.env` 中设置 `OPENAI_API_KEY`，不配置时AI功能会使用基础算法。

**Q: 数据库用的是什么？**
A: 开发环境使用 SQLite，生产环境建议使用 PostgreSQL 或 MySQL。

**Q: 如何部署到生产环境？**
A: 推荐使用 Vercel (前端) + Render (后端) 方案，详见 [部署指南](./PRODUCTION_DEPLOYMENT.md)。免费或仅需 $7/月即可实现永久在线。

**Q: SQLite 可以用于生产环境吗？**
A: 不推荐。生产环境已配置为使用 PostgreSQL（Render 免费提供 1GB）。

## 🤝 贡献

欢迎提交 Pull Request 或创建 Issue！

### 贡献指南
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License

## 📞 联系方式

如有问题或建议，请创建 Issue 或联系开发团队。

## 🙏 致谢

- React 团队
- Express.js 社区
- Prisma 团队
- OpenAI

---

**开发时间**: 2025-12-28
**版本**: 1.0.0
**开发者**: Kilo Code
**状态**: 持续开发中 🚀