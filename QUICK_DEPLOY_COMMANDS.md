# 🚀 一键部署命令清单

> 按顺序复制运行以下命令，即可完成从本地到生产环境的完整部署

---

## 📋 第一步：初始化 Git 仓库

```bash
# 初始化 Git 仓库
git init

# 添加所有文件到暂存区
git add .

# 提交代码
git commit -m "Initial commit: Smart Schedule Manager - 智能日程表应用"
```

---

## 📋 第二步：创建 GitHub 仓库

### 方式一：使用 GitHub CLI（推荐）

```bash
# 如果已安装 GitHub CLI，直接运行：
gh repo create smart-schedule-manager --public --source=. --remote=origin --push
```

### 方式二：手动创建

1. 打开浏览器访问：https://github.com/new
2. 创建新仓库（Repository name: `smart-schedule-manager`）
3. **不要**勾选 "Add a README file"
4. 点击 "Create repository"
5. 然后运行以下命令：

```bash
# 替换 YOUR_USERNAME 为你的 GitHub 用户名
git remote add origin https://github.com/YOUR_USERNAME/smart-schedule-manager.git

# 推送代码到 GitHub
git branch -M main
git push -u origin main
```

---

## 📋 第三步：部署后端到 Render

### 3.1 创建 PostgreSQL 数据库

1. 登录 https://dashboard.render.com
2. 点击 **New** → **PostgreSQL**
3. 填写：
   - Name: `smart-schedule-db`
   - Database: `smart_schedule`
   - User: `smart_schedule_user`
   - Region: `Singapore (Southeast Asia)`（亚洲用户推荐）
4. 选择 **Free** 计划
5. 点击 **Create Database**
6. 📝 **复制保存** `Internal Database URL`

### 3.2 创建 Web Service

1. 点击 **New** → **Web Service**
2. 连接你的 GitHub 仓库
3. 填写配置：

| 配置项 | 值 |
|--------|-----|
| Name | `smart-schedule-api` |
| Region | `Singapore (Southeast Asia)` |
| Branch | `main` |
| Root Directory | `backend` |
| Runtime | `Node` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |

4. 添加环境变量：

```
DATABASE_URL=<粘贴刚才复制的 Internal Database URL>
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
NODE_ENV=production
```

5. 选择 **Free** 计划
6. 点击 **Create Web Service**

### 3.3 运行数据库迁移

部署完成后：
1. 在 Render 仪表板中点击你的 Web Service
2. 点击右上角 **Shell**
3. 运行：

```bash
npm run prisma:migrate:deploy
```

4. 📝 **复制保存**后端 URL，格式如：`https://smart-schedule-api.onrender.com`

---

## 📋 第四步：部署前端到 Vercel

### 4.1 部署到 Vercel

1. 登录 https://vercel.com
2. 点击 **Add New** → **Project**
3. 导入你的 GitHub 仓库
4. 配置项目：

| 配置项 | 值 |
|--------|-----|
| Framework Preset | `Vite` |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

5. 添加环境变量：

```
VITE_API_BASE_URL=https://smart-schedule-api.onrender.com/api
```

> ⚠️ 替换为你的实际 Render 后端 URL

6. 点击 **Deploy**
7. 📝 **复制保存**前端 URL，格式如：`https://smart-schedule-manager.vercel.app`

---

## 📋 第五步：更新 CORS 配置

回到 Render 仪表板：
1. 点击你的 Web Service
2. 进入 **Environment**
3. 添加环境变量：

```
CORS_ORIGIN=https://smart-schedule-manager.vercel.app
```

> ⚠️ 替换为你的实际 Vercel 前端 URL

4. 点击 **Save Changes**
5. 服务会自动重新部署

---

## ✅ 部署完成检查

### 测试后端 API

```bash
# 替换为你的后端 URL
curl https://smart-schedule-api.onrender.com/health
```

应该返回：
```json
{"status":"ok","message":"Server is running"}
```

### 测试前端

打开浏览器访问你的 Vercel 前端 URL，尝试：
1. 注册新用户
2. 登录
3. 创建日程
4. 使用 AI 功能

---

## 🔄 后续更新部署

每次修改代码后，只需要：

```bash
# 添加修改的文件
git add .

# 提交修改
git commit -m "描述你的修改"

# 推送到 GitHub
git push
```

Vercel 和 Render 会**自动检测更新并重新部署**！

---

## 📊 成本概览

| 服务 | 免费配额 | 付费选项 |
|------|----------|----------|
| **Render Web Service** | 750 小时/月（会休眠） | $7/月（24/7 在线） |
| **Render PostgreSQL** | 90 天后过期 | $7/月 |
| **Vercel** | 100GB 带宽/月 | $20/月 |

💡 **推荐**：初期使用免费计划测试，稳定后升级 Render 到付费计划（$7-14/月）

---

## 🆘 常见问题

### Q: 后端返回 503 错误
A: 免费计划的后端会在 15 分钟无活动后休眠，首次访问需要 30-60 秒启动

### Q: 数据库连接失败
A: 确保 DATABASE_URL 使用的是 **Internal Database URL**，不是 External

### Q: CORS 错误
A: 确保 Render 的 CORS_ORIGIN 环境变量已设置为你的 Vercel 前端地址

### Q: 迁移失败
A: 在 Render Shell 中运行 `npx prisma migrate deploy`

---

## 📞 技术支持

- Render 文档：https://docs.render.com
- Vercel 文档：https://vercel.com/docs
- Prisma 文档：https://www.prisma.io/docs