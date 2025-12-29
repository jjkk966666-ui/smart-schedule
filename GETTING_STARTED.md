# 快速开始指南

本指南将帮助你快速搭建和运行智能日程表项目。

## 📋 前置要求

在开始之前,请确保你的系统已安装:

- **Node.js** 18 或更高版本
- **PostgreSQL** 14 或更高版本
- **npm** 或 **pnpm** 包管理器
- **OpenAI API密钥** (用于AI功能)

## 🚀 安装步骤

### 1. 安装依赖

#### 前端依赖
```bash
cd frontend
npm install
```

#### 后端依赖
```bash
cd backend
npm install
```

### 2. 配置环境变量

#### 后端环境变量

复制示例文件并编辑:
```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env` 文件,填入你的配置:

```env
# 数据库配置
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/smart_schedule

# JWT密钥(请使用强随机字符串)
JWT_SECRET=生成一个强随机密钥
JWT_REFRESH_SECRET=生成另一个强随机密钥

# OpenAI API密钥
OPENAI_API_KEY=sk-你的OpenAI密钥
```

**生成强随机密钥的方法:**
```bash
# 使用Node.js生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 前端环境变量

```bash
cd frontend
cp .env.example .env
```

编辑 `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3. 设置PostgreSQL数据库

#### 创建数据库
```bash
# 连接到PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE smart_schedule;

# 创建用户(可选)
CREATE USER smart_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE smart_schedule TO smart_user;

# 退出
\q
```

### 4. 运行数据库迁移

```bash
cd backend

# 生成Prisma Client
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# (可选)打开Prisma Studio查看数据库
npm run prisma:studio
```

### 5. 启动开发服务器

需要打开**两个终端窗口**:

#### 终端1 - 启动后端
```bash
cd backend
npm run dev
```

后端将运行在: `http://localhost:3000`

#### 终端2 - 启动前端
```bash
cd frontend
npm run dev
```

前端将运行在: `http://localhost:5173`

### 6. 访问应用

在浏览器中打开: `http://localhost:5173`

## 📁 项目结构说明

```
smart-schedule-manager/
├── frontend/           # React前端应用
│   ├── src/
│   │   ├── types/     # TypeScript类型定义
│   │   └── ...
│   └── package.json
│
├── backend/            # Express后端API
│   ├── src/
│   │   ├── config/    # 配置文件
│   │   ├── types/     # TypeScript类型定义
│   │   └── ...
│   ├── prisma/
│   │   └── schema.prisma  # 数据库模型
│   └── package.json
│
└── plans/              # 设计文档
    ├── architecture.md
    └── project-structure.md
```

## 🔧 常用命令

### 前端
```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run preview  # 预览生产构建
npm run lint     # 运行代码检查
```

### 后端
```bash
npm run dev              # 启动开发服务器(热重载)
npm run build            # TypeScript编译
npm run start            # 启动生产服务器
npm run prisma:generate  # 生成Prisma Client
npm run prisma:migrate   # 运行数据库迁移
npm run prisma:studio    # 打开Prisma Studio
```

## 🐛 常见问题

### 1. 数据库连接失败

**问题**: `Error: P1001: Can't reach database server`

**解决方案**:
- 确保PostgreSQL服务正在运行
- 检查`.env`文件中的`DATABASE_URL`是否正确
- 确认数据库已创建

### 2. Prisma Client未生成

**问题**: `Cannot find module '@prisma/client'`

**解决方案**:
```bash
cd backend
npm run prisma:generate
```

### 3. 端口已被占用

**问题**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决方案**:
- 方案1: 停止占用端口的程序
- 方案2: 修改`.env`中的`PORT`为其他端口

### 4. OpenAI API调用失败

**问题**: `401 Unauthorized`

**解决方案**:
- 确认`.env`中的`OPENAI_API_KEY`正确
- 检查API密钥是否有效
- 确认账户有足够余额

## 📚 下一步

1. 查看[架构设计文档](./plans/architecture.md)了解系统设计
2. 查看[项目结构文档](./plans/project-structure.md)了解代码组织
3. 开始实现核心功能

## 🤝 需要帮助?

- 查看项目文档
- 创建GitHub Issue
- 查看代码注释

---

**祝你使用愉快! 🎉**