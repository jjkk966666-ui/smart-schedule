# AI调用架构说明（简化版）

## 更新日期
2025-12-30

## 架构设计

### 简化后的架构
```
用户浏览器 (frontend)
    ↓
    HTTP请求到后端API
    ↓
后端服务器 (backend)
    ↓
    使用统一的系统级API密钥
    ↓
OpenAI API
```

## 关键改进

本系统已**移除用户自定义AI配置功能**,改为**统一使用后端配置的API密钥**：

### ✅ 优势

1. **更简单的部署**：
   - 只需在后端配置一次API密钥
   - 用户无需自己配置,开箱即用

2. **更好的成本控制**：
   - 管理员统一管理API使用
   - 可以设置速率限制和配额
   - 便于监控和追踪费用

3. **更高的安全性**：
   - 减少密钥泄露风险
   - 统一的安全策略
   - 无需在数据库存储用户密钥

## 配置说明

### 后端配置（必需）

在后端项目根目录创建 `.env` 文件：

```bash
# OpenAI API配置
OPENAI_API_KEY=sk-your-openai-api-key-here

# 可选：使用自定义API地址
# OPENAI_API_BASE_URL=https://api.openai.com/v1

# 可选：指定模型
# OPENAI_MODEL=gpt-4-turbo-preview
```

### 环境变量说明

| 变量名 | 是否必需 | 说明 | 默认值 |
|--------|---------|------|--------|
| `OPENAI_API_KEY` | ✅ 必需 | OpenAI API密钥 | 无 |
| `OPENAI_API_BASE_URL` | ⭕ 可选 | API基础URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | ⭕ 可选 | AI模型名称 | `gpt-4-turbo-preview` |

## 架构示意图

```
┌─────────────────┐
│   前端应用       │
│  (React/TS)     │
│                 │
│  ❌ 无AI配置界面 │
│  ❌ 无OpenAI依赖 │
└────────┬────────┘
         │ HTTP
         │ /api/ai/*
         ↓
┌─────────────────┐
│   后端服务       │
│  (Node.js/TS)   │
│                 │
│ ┌─────────────┐ │
│ │ .env 文件   │ │
│ │ OPENAI_KEY  │ │ ← 统一的系统密钥
│ └─────────────┘ │
└────────┬────────┘
         │ HTTPS
         │ API Key
         ↓
┌─────────────────┐
│   OpenAI API    │
└─────────────────┘
```

## 安全验证

### ✅ 已验证的安全特性

1. ✅ **前端隔离**: 前端代码不包含任何OpenAI SDK或API调用
2. ✅ **密钥安全**: API密钥仅存储在后端环境变量中
3. ✅ **无硬编码**: 代码中不存在硬编码的API密钥
4. ✅ **后端代理**: 所有AI功能都通过后端API代理
5. ✅ **简化架构**: 移除了用户级配置,降低复杂度

### 代码验证

**后端 - OpenAI客户端初始化**:
```typescript
// backend/src/services/ai.service.ts
private getOpenAIClient(): OpenAI | null {
  // ✅ 只使用系统级配置
  if (process.env.OPENAI_API_KEY) {
    return defaultOpenai;
  }
  return null;
}
```

**前端 - AI服务调用**:
```typescript
// frontend/src/services/aiService.ts
export const aiService = {
  // ✅ 只调用后端API,不直接调用OpenAI
  async analyzePlanning(taskDescription: string): Promise<AIPlanningResult> {
    const response = await api.post('/ai/analyze-planning', {
      taskDescription
    });
    return response.data.data;
  }
};
```

## 部署检查清单

### 开发环境
- [ ] 创建 `backend/.env` 文件
- [ ] 设置 `OPENAI_API_KEY`
- [ ] 验证 `.gitignore` 包含 `.env`
- [ ] 测试AI功能是否正常工作

### 生产环境
- [ ] 在服务器上设置环境变量 `OPENAI_API_KEY`
- [ ] 使用密钥管理服务（推荐：AWS Secrets Manager、Azure Key Vault）
- [ ] 配置速率限制和监控
- [ ] 定期审计API使用情况和费用

## 错误处理

如果AI功能不可用，用户会看到：
```
❌ AI服务未配置，请联系管理员
```

这表示后端未正确配置 `OPENAI_API_KEY`。

## 从旧版本升级

如果您从支持用户自定义配置的旧版本升级：

### 数据库变更（可选）
- 数据库中的 `aiApiKey`、`aiApiBaseUrl`、`aiModel` 字段已被忽略
- 可选择删除这些字段，但不影响功能

### 前端变更
- ✅ 已移除AI配置界面
- ✅ 已移除AI配置相关状态和逻辑
- ✅ 已移除AI状态检查功能

### 后端变更
- ✅ 简化了 `getOpenAIClient()` 方法
- ✅ 移除了用户级配置支持
- ✅ 移除了 `/auth/ai-config` API
- ✅ 移除了 `/ai/status` API

## 最佳实践

### ✅ 推荐做法
- 使用环境变量管理密钥
- 定期轮换API密钥
- 监控API使用量和成本
- 设置合理的速率限制
- 使用专用的密钥管理服务

### ❌ 避免做法
- 在代码中硬编码API密钥
- 将 `.env` 文件提交到版本控制
- 在前端代码中调用OpenAI API
- 在日志中输出API密钥
- 共享API密钥给未授权人员

## 监控建议

### API使用监控
```bash
# 记录每个请求的token使用量
# backend日志示例
[INFO] AI Request - User: user123, Tokens: 150, Model: gpt-4-turbo
[INFO] AI Request - User: user456, Tokens: 220, Model: gpt-4-turbo
```

### 成本追踪
- 定期检查OpenAI Dashboard
- 设置月度预算告警
- 监控异常高频调用
- 追踪每个功能的成本

## 故障排除

### 问题：AI功能返回错误
**检查**:
1. 后端 `.env` 文件是否存在
2. `OPENAI_API_KEY` 是否正确配置
3. API密钥是否有效且有余额
4. 网络是否能访问OpenAI API

### 问题：前端显示"AI服务未配置"
**解决**:
```bash
# 1. 检查后端环境变量
cd backend
cat .env | grep OPENAI_API_KEY

# 2. 重启后端服务
npm run dev

# 3. 测试API
curl -X POST http://localhost:3000/api/ai/suggest-time \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration": 60}'
```

## 技术支持

如有问题，请检查：
1. 后端 `.env` 文件是否存在且配置正确
2. API密钥是否有效（在OpenAI Dashboard验证）
3. 网络连接是否正常（测试访问 `https://api.openai.com`）
4. 后端服务日志中的错误信息

## 总结

✅ **架构已简化并验证安全**

- 前端不包含任何OpenAI相关代码或依赖
- 所有API密钥统一在后端管理
- 用户无需配置，管理员统一控制
- 前端通过后端API代理访问AI功能

**可以安全部署使用！**