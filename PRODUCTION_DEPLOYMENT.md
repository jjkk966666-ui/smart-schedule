# 生产环境部署指南

本指南将帮助你将智能日程表应用部署到 Vercel（前端）和 Render（后端），实现永久在线访问。

## 📋 前置准备

1. **GitHub 账号** - 用于连接 Vercel 和 Render
2. **Vercel 账号** - https://vercel.com （可用 GitHub 登录）
3. **Render 账号** - https://render.com （可用 GitHub 登录）

## 🗄️ 第一步：准备代码仓库

### 1. 创建 Git 仓库并推送代码

```bash
# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Smart Schedule Manager"

# 创建 GitHub 仓库后，添加远程仓库
git remote add origin https://github.com/你的用户名/smart-schedule.git

# 推送到 GitHub
git push -u origin main
```

### 2. 确保 .gitignore 正确配置

确保以下文件/文件夹被忽略：
```
node_modules/
dist/
.env
*.db
*.db-journal
.DS_Store
```

## 🚀 第二步：部署后端到 Render

### 1. 创建 PostgreSQL 数据库

1. 登录 Render Dashboard
2. 点击 "New +" → "PostgreSQL"
3. 配置数据库：
   - Name: `smart-schedule-db`
   - Database: `smart_schedule`
   - User: `smart_schedule_user`
   - Region: 选择离你最近的区域
   - Plan: Free (或根据需求选择)
4. 点击 "Create Database"
5. **重要**：复制数据库的 "Internal Database URL"（格式类似：`postgresql://user:password@host:5432/dbname`）

### 2. 部署后端服务

1. 在 Render Dashboard，点击 "New +" → "Web Service"
2. 连接你的 GitHub 仓库
3. 配置服务：
   - Name: `smart-schedule-api`
   - Root Directory: `backend`
   - Environment: `Node`
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npm start`
   - Plan: Free (或根据需求选择)

4. **添加环境变量**（在 "Environment" 标签页）：

```bash
# 数据库连接
DATABASE_URL=你刚才复制的 PostgreSQL Internal URL

# JWT 配置
JWT_SECRET=你的超级安全的密钥（至少32位随机字符串）
JWT_EXPIRES_IN=7d

# Node 环境
NODE_ENV=production

# CORS 配置（部署前端后更新）
CORS_ORIGIN=https://你的vercel域名.vercel.app
```

5. 点击 "Create Web Service"

6. **运行数据库迁移**：
   - 等待服务首次部署完成
   - 在 Render Dashboard，进入你的服务
   - 点击 "Shell" 标签
   - 运行命令：`npm run prisma:migrate:deploy`

7. **记录后端 URL**：
   - 服务部署成功后，记录你的后端 URL（类似：`https://smart-schedule-api.onrender.com`）

## 🎨 第三步：部署前端到 Vercel

### 1. 导入项目到 Vercel

1. 登录 Vercel Dashboard
2. 点击 "Add New..." → "Project"
3. 从 GitHub 导入你的仓库
4. 配置项目：
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 2. 配置环境变量

在 "Environment Variables" 部分添加：

```bash
VITE_API_BASE_URL=https://你的render后端地址.onrender.com/api
```

例如：
```bash
VITE_API_BASE_URL=https://smart-schedule-api.onrender.com/api
```

### 3. 部署

1. 点击 "Deploy"
2. 等待部署完成（约 1-2 分钟）
3. 记录你的前端 URL（类似：`https://smart-schedule-xxx.vercel.app`）

## 🔄 第四步：更新后端 CORS 配置

1. 回到 Render Dashboard
2. 进入你的后端服务
3. 进入 "Environment" 标签
4. 更新 `CORS_ORIGIN` 环境变量为你的 Vercel 前端 URL：
   ```
   CORS_ORIGIN=https://smart-schedule-xxx.vercel.app
   ```
5. 保存更改（服务会自动重新部署）

## ✅ 第五步：测试部署

1. 访问你的 Vercel 前端 URL
2. 尝试注册一个新账号
3. 登录并测试日程管理功能
4. 测试 AI 功能（需要先配置 AI API Key）

## 🔧 常见问题排查

### 问题 1：前端无法连接后端

**检查项：**
- 后端服务是否正常运行（访问 `你的后端URL/health` 应返回 `{"status":"ok"}`）
- 前端环境变量 `VITE_API_BASE_URL` 是否正确
- 后端 CORS 配置是否包含前端域名

### 问题 2：数据库连接失败

**检查项：**
- `DATABASE_URL` 环境变量是否正确
- PostgreSQL 数据库是否正常运行
- 是否已运行数据库迁移

### 问题 3：Render 服务频繁休眠

**解决方案：**
- 免费版 Render 服务会在无活动 15 分钟后休眠
- 升级到付费计划可避免休眠
- 或使用外部服务定期 ping 你的后端（如 UptimeRobot）

### 问题 4：环境变量更改后未生效

**解决方案：**
- 在 Render/Vercel 更改环境变量后需要重新部署
- Render: 保存环境变量后会自动重新部署
- Vercel: 在 Deployments 页面点击最新部署的菜单，选择 "Redeploy"

## 🔄 后续更新部署

### 更新前端

```bash
# 提交代码变更
git add .
git commit -m "Update frontend"
git push

# Vercel 会自动检测并部署
```

### 更新后端

```bash
# 提交代码变更
git add .
git commit -m "Update backend"
git push

# Render 会自动检测并部署
```

### 数据库 Schema 变更

如果修改了 `backend/prisma/schema.prisma`：

```bash
# 本地生成迁移
cd backend
npx prisma migrate dev --name 描述变更内容

# 提交并推送
git add .
git commit -m "Database schema update"
git push

# 推送后，在 Render Shell 中运行：
npm run prisma:migrate:deploy
```

## 💰 成本估算

### 免费方案
- **Vercel**: 免费版足够个人使用
- **Render**: 
  - Web Service: 免费（会休眠）
  - PostgreSQL: 免费 1GB 存储

**总成本：$0/月**

### 推荐付费方案（如需 24/7 在线）
- **Vercel**: 免费版即可
- **Render**:
  - Web Service: $7/月（不休眠）
  - PostgreSQL: 免费 1GB 存储

**总成本：约 $7/月**

## 🔐 安全建议

1. **定期更换密钥**：
   - 定期更换 `JWT_SECRET`
   - 更换后所有用户需要重新登录

2. **环境变量保护**：
   - 永远不要将 `.env` 文件提交到 Git
   - 使用强随机密钥

3. **数据库备份**：
   - 定期导出数据库备份
   - 使用 Render 的数据库备份功能

4. **监控日志**：
   - 定期检查 Render 和 Vercel 的日志
   - 关注异常错误和性能问题

## 📚 相关资源

- [Vercel 文档](https://vercel.com/docs)
- [Render 文档](https://render.com/docs)
- [Prisma 部署指南](https://www.prisma.io/docs/guides/deployment)

## 🆘 获取帮助

如遇到问题：
1. 检查服务日志（Render Dashboard → Logs，Vercel Dashboard → Deployments → Logs）
2. 验证环境变量配置
3. 确认数据库连接状态
4. 查看本项目的 GitHub Issues