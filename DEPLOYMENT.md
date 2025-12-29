# 部署指南

本文档介绍如何将智能日程表系统部署到生产环境。

## 目录

- [使用 Docker 部署](#使用-docker-部署)
- [手动部署](#手动部署)
- [环境变量配置](#环境变量配置)
- [数据库迁移](#数据库迁移)
- [性能优化](#性能优化)
- [监控和日志](#监控和日志)
- [常见问题](#常见问题)

---

## 使用 Docker 部署

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+

### 快速部署

1. **克隆项目**
```bash
git clone <repository-url>
cd smart-schedule-manager
```

2. **创建环境变量文件**
```bash
cp .env.example .env
```

编辑 `.env` 文件，设置必要的环境变量：
```env
JWT_SECRET=your-production-secret-key-minimum-32-characters
JWT_REFRESH_SECRET=your-production-refresh-secret-key-minimum-32-characters
OPENAI_API_KEY=sk-your-openai-api-key
```

3. **构建并启动容器**
```bash
docker-compose up -d
```

4. **查看日志**
```bash
docker-compose logs -f
```

5. **访问应用**
- 前端: http://localhost:5173
- 后端: http://localhost:3000

### Docker 命令

**停止服务**
```bash
docker-compose down
```

**重新构建**
```bash
docker-compose up -d --build
```

**查看容器状态**
```bash
docker-compose ps
```

**查看特定服务日志**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

**进入容器**
```bash
docker-compose exec backend sh
docker-compose exec frontend sh
```

---

## 手动部署

### 后端部署

1. **安装依赖**
```bash
cd backend
npm ci --only=production
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件
```

3. **构建项目**
```bash
npm run build
```

4. **运行数据库迁移**
```bash
npx prisma migrate deploy
npx prisma generate
```

5. **启动服务**
```bash
NODE_ENV=production node dist/server.js
```

### 使用 PM2 管理进程

1. **安装 PM2**
```bash
npm install -g pm2
```

2. **创建 ecosystem.config.js**
```javascript
module.exports = {
  apps: [{
    name: 'schedule-backend',
    script: './dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

3. **启动应用**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 前端部署

1. **安装依赖**
```bash
cd frontend
npm ci
```

2. **配置环境变量**
```bash
# 创建 .env.production
VITE_API_URL=https://api.yourdomain.com
```

3. **构建项目**
```bash
npm run build
```

4. **部署到静态服务器**

使用 Nginx:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/schedule/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 环境变量配置

### 后端环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `DATABASE_URL` | 是 | - | 数据库连接字符串 |
| `JWT_SECRET` | 是 | - | JWT 签名密钥 (至少32字符) |
| `JWT_REFRESH_SECRET` | 是 | - | Refresh Token 密钥 |
| `JWT_EXPIRES_IN` | 否 | 15m | Access Token 过期时间 |
| `JWT_REFRESH_EXPIRES_IN` | 否 | 7d | Refresh Token 过期时间 |
| `OPENAI_API_KEY` | 否 | - | OpenAI API 密钥 (可选) |
| `OPENAI_MODEL` | 否 | gpt-4 | OpenAI 模型 |
| `PORT` | 否 | 3000 | 服务器端口 |
| `NODE_ENV` | 否 | development | 运行环境 |
| `CORS_ORIGIN` | 否 | * | CORS 允许的源 |

### 前端环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `VITE_API_URL` | 是 | http://localhost:3000 | 后端 API 地址 |

---

## 数据库迁移

### 开发环境

```bash
npx prisma migrate dev
```

### 生产环境

```bash
npx prisma migrate deploy
```

### 回滚迁移

Prisma 不直接支持回滚，需要手动操作：

1. 找到要回滚的迁移文件
2. 创建新的迁移来撤销更改
3. 运行新迁移

### 数据库备份

**SQLite 备份**
```bash
cp backend/prisma/dev.db backend/prisma/backup_$(date +%Y%m%d).db
```

**PostgreSQL 备份**
```bash
pg_dump -U username dbname > backup_$(date +%Y%m%d).sql
```

---

## 性能优化

### 后端优化

1. **启用 Gzip 压缩**
```typescript
import compression from 'compression';
app.use(compression());
```

2. **使用集群模式**
```bash
pm2 start server.js -i max
```

3. **数据库索引优化**
```prisma
model Schedule {
  // 添加索引
  @@index([userId])
  @@index([startTime])
  @@index([priority])
}
```

4. **启用缓存**
```typescript
// 使用 Redis 缓存
import Redis from 'ioredis';
const redis = new Redis();
```

### 前端优化

1. **代码分割**
```typescript
const Component = lazy(() => import('./Component'));
```

2. **静态资源压缩**
- 已在 nginx.conf 中配置 Gzip

3. **CDN 加速**
- 将静态资源部署到 CDN

4. **缓存策略**
- 已在 nginx.conf 中配置缓存

---

## 监控和日志

### 日志管理

**使用 PM2 查看日志**
```bash
pm2 logs
pm2 logs backend --lines 100
```

**日志文件位置**
- PM2: `~/.pm2/logs/`
- Docker: `docker-compose logs`

### 监控指标

**系统监控**
```bash
pm2 monit
```

**Docker 监控**
```bash
docker stats
```

### 错误追踪

建议集成错误追踪服务：
- Sentry
- Datadog
- New Relic

---

## 安全建议

1. **使用 HTTPS**
```bash
# 使用 Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

2. **设置防火墙**
```bash
# UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

3. **定期更新依赖**
```bash
npm audit
npm audit fix
```

4. **环境变量保护**
- 不要提交 `.env` 文件到版本控制
- 使用密钥管理服务

5. **限流保护**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制100次请求
});

app.use('/api/', limiter);
```

---

## 常见问题

### Q: Docker 容器无法启动？

**A:** 检查日志
```bash
docker-compose logs backend
```

常见原因：
- 端口被占用
- 环境变量未设置
- 数据库连接失败

### Q: 数据库迁移失败？

**A:** 确保数据库可访问
```bash
npx prisma db push --skip-generate
```

### Q: 前端无法连接后端？

**A:** 检查 CORS 配置和环境变量
```env
CORS_ORIGIN=http://your-frontend-domain.com
```

### Q: 性能问题？

**A:** 
1. 检查数据库查询效率
2. 启用缓存
3. 使用 CDN
4. 启用 Gzip 压缩

### Q: 如何升级到生产数据库？

**A:** 修改 `DATABASE_URL`
```env
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/schedule_db"

# MySQL
DATABASE_URL="mysql://user:password@localhost:3306/schedule_db"
```

然后运行迁移：
```bash
npx prisma migrate deploy
```

---

## 云平台部署

### Vercel (前端)

1. 连接 GitHub 仓库
2. 设置构建命令: `npm run build`
3. 设置输出目录: `dist`
4. 添加环境变量: `VITE_API_URL`

### Railway (后端)

1. 连接 GitHub 仓库
2. 选择 backend 目录
3. 添加环境变量
4. 自动部署

### AWS / Azure / GCP

参考各平台的 Node.js 部署文档。

---

## 维护清单

**日常维护**
- [ ] 检查日志错误
- [ ] 监控磁盘空间
- [ ] 检查数据库性能

**每周维护**
- [ ] 检查安全更新
- [ ] 备份数据库
- [ ] 审查访问日志

**每月维护**
- [ ] 更新依赖包
- [ ] 性能优化
- [ ] 安全审计

---

## 联系支持

如有部署问题，请：
1. 查看 [GitHub Issues](链接)
2. 阅读 [文档](链接)
3. 联系技术支持

---

**最后更新**: 2025-12-28  
**版本**: 1.0.0