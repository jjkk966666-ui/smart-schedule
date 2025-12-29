# 🚀 部署检查清单

按照此清单逐步完成部署，确保不遗漏任何步骤。

## ✅ 部署前准备

- [ ] 代码已推送到 GitHub
- [ ] 确认 `.gitignore` 正确配置（不包含 `.env`、`node_modules` 等）
- [ ] 已注册 Render 和 Vercel 账号

## 📦 第一步：部署后端到 Render

### 1.1 创建 PostgreSQL 数据库
- [ ] 登录 Render Dashboard
- [ ] 创建新的 PostgreSQL 数据库
- [ ] 复制 Internal Database URL

### 1.2 部署后端服务
- [ ] 创建新的 Web Service
- [ ] 连接 GitHub 仓库
- [ ] 设置 Root Directory 为 `backend`
- [ ] 配置环境变量：
  - [ ] `DATABASE_URL` (PostgreSQL URL)
  - [ ] `JWT_SECRET` (至少32位随机字符)
  - [ ] `JWT_REFRESH_SECRET` (至少32位随机字符)
  - [ ] `NODE_ENV=production`
  - [ ] `CORS_ORIGIN` (暂时设为 `*`，部署前端后更新)
- [ ] 等待首次部署完成
- [ ] 在 Shell 中运行: `npm run prisma:migrate:deploy`
- [ ] 记录后端 URL

## 🎨 第二步：部署前端到 Vercel

### 2.1 导入项目
- [ ] 登录 Vercel Dashboard
- [ ] 导入 GitHub 仓库
- [ ] 设置 Root Directory 为 `frontend`
- [ ] Framework Preset 选择 `Vite`

### 2.2 配置环境变量
- [ ] 添加 `VITE_API_BASE_URL` = `https://你的render后端.onrender.com/api`

### 2.3 部署
- [ ] 点击 Deploy
- [ ] 等待部署完成
- [ ] 记录前端 URL

## 🔄 第三步：更新 CORS 配置

- [ ] 回到 Render Dashboard
- [ ] 更新后端 `CORS_ORIGIN` 为你的 Vercel URL
- [ ] 等待自动重新部署

## ✨ 第四步：测试

- [ ] 访问前端 URL
- [ ] 注册新账号
- [ ] 登录成功
- [ ] 创建日程
- [ ] 测试 AI 功能（需先配置 API Key）

## 🎉 完成！

你的应用现已永久在线！

---

## 📝 重要信息记录

**后端 URL**: `https://________________.onrender.com`

**前端 URL**: `https://________________.vercel.app`

**数据库**: Render PostgreSQL

**JWT_SECRET**: `记录在安全的地方，不要分享`

---

## 🔧 故障排查

如果遇到问题，请检查：

1. **前端无法连接后端**
   - 检查 `VITE_API_BASE_URL` 是否正确
   - 检查后端 CORS 配置
   - 访问 `后端URL/health` 确认后端正常

2. **注册/登录失败**
   - 检查数据库迁移是否成功运行
   - 查看 Render 后端日志
   - 确认 `DATABASE_URL` 配置正确

3. **AI 功能不工作**
   - 在前端配置页面设置 OpenAI API Key
   - 检查后端日志是否有 API 调用错误

## 📚 相关文档

- 详细部署指南: [`PRODUCTION_DEPLOYMENT.md`](./PRODUCTION_DEPLOYMENT.md)
- API 文档: [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)
- 项目说明: [`README.md`](./README.md)