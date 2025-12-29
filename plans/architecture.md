# 智能日程表系统 - 架构设计文档

## 1. 项目概述

### 1.1 项目名称
智能日程表管理系统 (Smart Schedule Manager)

### 1.2 项目描述
一个功能完整的全栈智能日程表应用，支持多用户管理日程、AI智能分析、冲突检测和优化建议。

### 1.3 核心功能
- **用户认证与授权**：注册、登录、JWT令牌管理
- **日程管理**：创建、编辑、删除、查看日程
- **智能分析**：使用 OpenAI API 进行日程冲突检测和智能推荐
- **多用户支持**：用户隔离、权限管理
- **实时通知**：日程提醒、冲突预警
- **日历视图**：月视图、周视图、日视图
- **智能优化**：AI 建议最佳日程安排

---

## 2. 系统架构

### 2.1 整体架构图

```mermaid
graph TB
    Client[React前端应用]
    API[Express API服务器]
    DB[(PostgreSQL数据库)]
    OpenAI[OpenAI API]
    Auth[JWT认证中间件]
    
    Client -->|HTTP/REST| API
    API -->|验证令牌| Auth
    Auth -->|查询/更新| DB
    API -->|查询/更新| DB
    API -->|AI分析请求| OpenAI
    OpenAI -->|智能建议| API
    API -->|响应| Client
```

### 2.2 分层架构

```mermaid
graph LR
    subgraph Frontend[前端层]
        UI[UI组件]
        Store[状态管理]
        API_Client[API客户端]
    end
    
    subgraph Backend[后端层]
        Routes[路由层]
        Controllers[控制器层]
        Services[服务层]
        Models[模型层]
    end
    
    subgraph Data[数据层]
        PostgreSQL[(PostgreSQL)]
    end
    
    subgraph External[外部服务]
        OpenAI_Service[OpenAI API]
    end
    
    UI --> Store
    Store --> API_Client
    API_Client --> Routes
    Routes --> Controllers
    Controllers --> Services
    Services --> Models
    Models --> PostgreSQL
    Services --> OpenAI_Service
```

---

## 3. 技术栈详情

### 3.1 前端技术栈
- **核心框架**：React 18+
- **类型系统**：TypeScript 5+
- **状态管理**：Redux Toolkit / Zustand
- **路由**：React Router v6
- **UI组件库**：Material-UI (MUI) / Ant Design
- **日期处理**：date-fns / Day.js
- **HTTP客户端**：Axios
- **表单管理**：React Hook Form
- **日历组件**：FullCalendar / React Big Calendar
- **构建工具**：Vite

### 3.2 后端技术栈
- **运行环境**：Node.js 18+
- **Web框架**：Express.js
- **类型系统**：TypeScript
- **ORM**：Prisma / TypeORM
- **认证**：JWT (jsonwebtoken)
- **密码加密**：bcrypt
- **验证**：Joi / Zod
- **API文档**：Swagger / OpenAPI
- **日志**：Winston
- **测试**：Jest

### 3.3 数据库
- **数据库**：PostgreSQL 14+
- **连接池**：pg
- **迁移工具**：Prisma Migrate / TypeORM migrations

### 3.4 外部服务
- **AI服务**：OpenAI API (GPT-4 / GPT-3.5-turbo)

### 3.5 开发工具
- **包管理器**：npm / pnpm
- **代码规范**：ESLint + Prettier
- **Git钩子**：Husky + lint-staged
- **API测试**：Postman / Thunder Client

---

## 4. 数据库设计

### 4.1 数据库ER图

```mermaid
erDiagram
    USERS ||--o{ SCHEDULES : creates
    USERS ||--o{ REFRESH_TOKENS : has
    SCHEDULES ||--o{ SCHEDULE_TAGS : has
    TAGS ||--o{ SCHEDULE_TAGS : belongs_to
    SCHEDULES ||--o{ AI_SUGGESTIONS : generates
    
    USERS {
        uuid id PK
        string email UK
        string password_hash
        string name
        string avatar_url
        timestamp created_at
        timestamp updated_at
    }
    
    SCHEDULES {
        uuid id PK
        uuid user_id FK
        string title
        text description
        timestamp start_time
        timestamp end_time
        string location
        string priority
        string status
        boolean is_all_day
        text recurrence_rule
        timestamp created_at
        timestamp updated_at
    }
    
    TAGS {
        uuid id PK
        string name UK
        string color
        timestamp created_at
    }
    
    SCHEDULE_TAGS {
        uuid schedule_id FK
        uuid tag_id FK
    }
    
    AI_SUGGESTIONS {
        uuid id PK
        uuid schedule_id FK
        text suggestion_type
        text content
        json metadata
        timestamp created_at
    }
    
    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        string token
        timestamp expires_at
        timestamp created_at
    }
```

### 4.2 表结构说明

#### users 表
存储用户基本信息和认证数据。

#### schedules 表
存储日程信息，包括时间、地点、优先级等。
- `priority`: 'low' | 'medium' | 'high' | 'urgent'
- `status`: 'pending' | 'in_progress' | 'completed' | 'cancelled'
- `recurrence_rule`: 支持 iCalendar RRULE 格式

#### tags 表
日程标签分类（工作、个人、学习等）。

#### schedule_tags 表
多对多关系表，连接日程和标签。

#### ai_suggestions 表
存储AI生成的建议和分析结果。
- `suggestion_type`: 'conflict' | 'optimization' | 'recommendation'

#### refresh_tokens 表
存储刷新令牌，用于JWT认证机制。

---

## 5. API设计

### 5.1 API概述
RESTful API设计，使用JSON格式进行数据交换。

### 5.2 认证端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/auth/register | 用户注册 | 否 |
| POST | /api/auth/login | 用户登录 | 否 |
| POST | /api/auth/logout | 用户登出 | 是 |
| POST | /api/auth/refresh | 刷新访问令牌 | 是 |
| GET | /api/auth/me | 获取当前用户信息 | 是 |

### 5.3 日程端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | /api/schedules | 获取日程列表 | 是 |
| GET | /api/schedules/:id | 获取单个日程详情 | 是 |
| POST | /api/schedules | 创建新日程 | 是 |
| PUT | /api/schedules/:id | 更新日程 | 是 |
| DELETE | /api/schedules/:id | 删除日程 | 是 |
| GET | /api/schedules/calendar | 获取日历视图数据 | 是 |

### 5.4 AI功能端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/ai/analyze-conflicts | 分析日程冲突 | 是 |
| POST | /api/ai/suggest-time | 智能推荐时间段 | 是 |
| POST | /api/ai/optimize-schedule | 优化日程安排 | 是 |
| GET | /api/ai/suggestions/:scheduleId | 获取日程的AI建议 | 是 |

### 5.5 标签端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | /api/tags | 获取所有标签 | 是 |
| POST | /api/tags | 创建新标签 | 是 |
| PUT | /api/tags/:id | 更新标签 | 是 |
| DELETE | /api/tags/:id | 删除标签 | 是 |

### 5.6 API响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }
  }
}
```

---

## 6. AI功能设计

### 6.1 OpenAI集成架构

```mermaid
graph TB
    Schedule[用户日程数据]
    Formatter[数据格式化服务]
    OpenAI[OpenAI API]
    Parser[响应解析器]
    Suggestions[AI建议存储]
    
    Schedule --> Formatter
    Formatter -->|构建Prompt| OpenAI
    OpenAI -->|AI响应| Parser
    Parser --> Suggestions
    Suggestions -->|返回给用户| Schedule
```

### 6.2 AI功能模块

#### 6.2.1 日程冲突检测
- **输入**：用户的所有日程
- **处理**：使用GPT分析时间重叠、优先级冲突
- **输出**：冲突列表和严重程度评估

#### 6.2.2 智能时间推荐
- **输入**：日程类型、持续时间、优先级
- **处理**：分析用户习惯、现有日程，推荐最佳时间段
- **输出**：推荐的时间段列表（包含理由）

#### 6.2.3 日程优化建议
- **输入**：一周/一月的所有日程
- **处理**：分析工作生活平衡、效率优化
- **输出**：具体优化建议

### 6.3 Prompt设计示例

```typescript
const conflictAnalysisPrompt = `
你是一个智能日程助手。请分析以下日程安排，找出所有冲突和问题。

用户日程：
${JSON.stringify(schedules, null, 2)}

请以JSON格式返回分析结果：
{
  "conflicts": [
    {
      "scheduleIds": ["id1", "id2"],
      "type": "time_overlap",
      "severity": "high|medium|low",
      "description": "冲突描述"
    }
  ],
  "suggestions": [
    {
      "scheduleId": "id",
      "suggestion": "建议内容",
      "reason": "原因说明"
    }
  ]
}
`;
```

---

## 7. 前端架构

### 7.1 项目结构

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── assets/              # 静态资源
│   ├── components/          # 可复用组件
│   │   ├── common/          # 通用组件
│   │   ├── layout/          # 布局组件
│   │   └── schedule/        # 日程相关组件
│   ├── pages/               # 页面组件
│   │   ├── Auth/            # 认证页面
│   │   ├── Dashboard/       # 仪表板
│   │   ├── Calendar/        # 日历视图
│   │   └── Schedule/        # 日程管理
│   ├── hooks/               # 自定义Hooks
│   ├── services/            # API服务
│   ├── store/               # 状态管理
│   ├── types/               # TypeScript类型定义
│   ├── utils/               # 工具函数
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── tsconfig.json
```

### 7.2 状态管理

使用 Redux Toolkit 进行状态管理：

```typescript
// store结构
{
  auth: {
    user: User | null,
    token: string | null,
    isAuthenticated: boolean
  },
  schedules: {
    items: Schedule[],
    loading: boolean,
    error: string | null
  },
  ai: {
    suggestions: AISuggestion[],
    loading: boolean
  }
}
```

### 7.3 核心页面

1. **登录/注册页面**
2. **仪表板**：概览、统计、快速操作
3. **日历视图**：月/周/日视图切换
4. **日程列表**：可筛选、排序
5. **日程详情/编辑**
6. **AI建议页面**：显示智能分析结果
7. **设置页面**：用户配置

---

## 8. 后端架构

### 8.1 项目结构

```
backend/
├── src/
│   ├── config/              # 配置文件
│   │   ├── database.ts
│   │   ├── jwt.ts
│   │   └── openai.ts
│   ├── controllers/         # 控制器
│   │   ├── auth.controller.ts
│   │   ├── schedule.controller.ts
│   │   ├── ai.controller.ts
│   │   └── tag.controller.ts
│   ├── middlewares/         # 中间件
│   │   ├── auth.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── error.middleware.ts
│   ├── models/              # 数据模型
│   │   ├── User.ts
│   │   ├── Schedule.ts
│   │   ├── Tag.ts
│   │   └── AISuggestion.ts
│   ├── routes/              # 路由
│   │   ├── auth.routes.ts
│   │   ├── schedule.routes.ts
│   │   ├── ai.routes.ts
│   │   └── tag.routes.ts
│   ├── services/            # 业务逻辑
│   │   ├── auth.service.ts
│   │   ├── schedule.service.ts
│   │   ├── ai.service.ts
│   │   └── tag.service.ts
│   ├── utils/               # 工具函数
│   │   ├── jwt.util.ts
│   │   ├── bcrypt.util.ts
│   │   └── validation.util.ts
│   ├── types/               # TypeScript类型
│   │   └── index.ts
│   ├── app.ts               # Express应用
│   └── server.ts            # 服务器入口
├── prisma/                  # Prisma配置
│   ├── schema.prisma
│   └── migrations/
├── package.json
└── tsconfig.json
```

### 8.2 中间件流程

```mermaid
graph LR
    Request[HTTP请求]
    CORS[CORS中间件]
    BodyParser[Body Parser]
    Auth[JWT验证]
    Validation[数据验证]
    Controller[控制器]
    ErrorHandler[错误处理]
    Response[HTTP响应]
    
    Request --> CORS
    CORS --> BodyParser
    BodyParser --> Auth
    Auth --> Validation
    Validation --> Controller
    Controller --> ErrorHandler
    ErrorHandler --> Response
```

---

## 9. 安全性设计

### 9.1 认证与授权
- **JWT令牌**：访问令牌（15分钟）+ 刷新令牌（7天）
- **密码存储**：bcrypt加密，至少10轮盐
- **HTTPS**：所有API通信使用HTTPS
- **CORS**：配置允许的源

### 9.2 数据验证
- 所有输入使用Joi/Zod验证
- SQL注入防护（使用ORM参数化查询）
- XSS防护（输入净化）

### 9.3 速率限制
- 登录端点：每IP每小时最多5次失败尝试
- API端点：每用户每分钟100次请求
- OpenAI调用：限制频率和成本

### 9.4 环境变量管理
敏感信息存储在`.env`文件中：
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
OPENAI_API_KEY=...
```

---

## 10. 部署策略

### 10.1 开发环境
- 前端：Vite开发服务器（http://localhost:5173）
- 后端：Express服务器（http://localhost:3000）
- 数据库：本地PostgreSQL

### 10.2 生产环境选项

#### 选项A：传统部署
- **前端**：Nginx + 静态文件托管
- **后端**：PM2 + Node.js
- **数据库**：PostgreSQL（独立服务器或云服务）
- **反向代理**：Nginx

#### 选项B：容器化部署
- **Docker**：前端、后端、数据库各自容器
- **Docker Compose**：本地开发和测试
- **Kubernetes**：生产环境编排

#### 选项C：云平台部署
- **前端**：Vercel / Netlify
- **后端**：Railway / Render / AWS EC2
- **数据库**：AWS RDS / Supabase / Neon

### 10.3 CI/CD流程

```mermaid
graph LR
    Code[代码提交]
    Test[自动测试]
    Build[构建]
    Deploy[部署]
    
    Code -->|GitHub Push| Test
    Test -->|测试通过| Build
    Build -->|构建成功| Deploy
    Deploy -->|自动部署| Production[生产环境]
```

---

## 11. 性能优化

### 11.1 前端优化
- 代码分割和懒加载
- 图片优化和CDN
- Service Worker缓存
- React.memo和useMemo优化渲染

### 11.2 后端优化
- 数据库索引优化
- 查询结果缓存（Redis）
- API响应压缩
- 连接池管理

### 11.3 OpenAI调用优化
- 结果缓存（相似查询）
- 批量处理
- 成本控制和监控

---

## 12. 测试策略

### 12.1 前端测试
- **单元测试**：Jest + React Testing Library
- **集成测试**：测试组件交互
- **E2E测试**：Playwright / Cypress

### 12.2 后端测试
- **单元测试**：Jest测试服务层
- **集成测试**：Supertest测试API
- **数据库测试**：使用测试数据库

---

## 13. 监控与日志

### 13.1 应用监控
- 错误追踪（Sentry）
- 性能监控（New Relic / DataDog）
- 用户行为分析（Google Analytics）

### 13.2 日志管理
- Winston日志框架
- 日志级别：error, warn, info, debug
- 日志存储和查询

---

## 14. 扩展性考虑

### 14.1 未来功能
- 移动端应用（React Native）
- 团队协作和共享日程
- 第三方日历集成（Google Calendar, Outlook）
- 语音输入创建日程
- 更高级的AI功能（自然语言处理）

### 14.2 可扩展性
- 微服务架构迁移
- 消息队列（RabbitMQ / Kafka）
- 缓存层（Redis）
- 负载均衡

---

## 15. 项目时间线

本架构设计为项目实施提供了完整的技术蓝图。具体的实施步骤和时间规划请参考待办事项列表。

---

## 附录

### A. 推荐的NPM包

#### 前端
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@reduxjs/toolkit": "^2.0.0",
    "react-redux": "^9.0.0",
    "axios": "^1.6.0",
    "react-hook-form": "^7.49.0",
    "@mui/material": "^5.15.0",
    "date-fns": "^3.0.0",
    "react-big-calendar": "^1.10.0"
  }
}
```

#### 后端
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "typescript": "^5.3.0",
    "@prisma/client": "^5.7.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "joi": "^17.11.0",
    "winston": "^3.11.0",
    "dotenv": "^16.3.0",
    "openai": "^4.24.0"
  }
}
```

### B. 环境变量模板

```env
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/smart_schedule

# JWT
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# 服务器
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# 速率限制
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

**文档版本**: 1.0  
**创建日期**: 2025-12-28  
**作者**: Kilo Code