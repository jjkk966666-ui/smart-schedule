# 智能日程表 API 文档

## 基础信息

- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json`
- **认证方式**: JWT Bearer Token

## 认证相关 API

### 1. 用户注册

**接口**: `POST /api/auth/register`

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "用户名",
      "avatarUrl": null
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

**状态码**:
- `200`: 注册成功
- `400`: 请求参数错误
- `409`: 邮箱已存在

---

### 2. 用户登录

**接口**: `POST /api/auth/login`

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "用户名",
      "avatarUrl": null
    },
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

**状态码**:
- `200`: 登录成功
- `401`: 邮箱或密码错误

---

### 3. 刷新Token

**接口**: `POST /api/auth/refresh`

**请求体**:
```json
{
  "refreshToken": "refresh_token"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_token",
    "refreshToken": "new_refresh_token"
  }
}
```

---

### 4. 获取当前用户信息

**接口**: `GET /api/auth/me`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "用户名",
    "avatarUrl": null,
    "createdAt": "2025-12-28T00:00:00.000Z",
    "updatedAt": "2025-12-28T00:00:00.000Z"
  }
}
```

---

## 日程管理 API

### 5. 获取日程列表

**接口**: `GET /api/schedules`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数** (可选):
- `startDate`: 开始日期 (ISO-8601)
- `endDate`: 结束日期 (ISO-8601)
- `status`: 状态筛选 (`pending` | `in_progress` | `completed` | `cancelled`)
- `priority`: 优先级筛选 (`low` | `medium` | `high` | `urgent`)
- `search`: 搜索关键词
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 50)

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "userId": "uuid",
        "title": "团队会议",
        "description": "讨论项目进度",
        "startTime": "2025-12-28T10:00:00.000Z",
        "endTime": "2025-12-28T11:00:00.000Z",
        "location": "会议室A",
        "priority": "high",
        "status": "pending",
        "isAllDay": false,
        "recurrenceRule": null,
        "tags": [],
        "createdAt": "2025-12-28T00:00:00.000Z",
        "updatedAt": "2025-12-28T00:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

---

### 6. 获取单个日程

**接口**: `GET /api/schedules/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "title": "团队会议",
    "description": "讨论项目进度",
    "startTime": "2025-12-28T10:00:00.000Z",
    "endTime": "2025-12-28T11:00:00.000Z",
    "location": "会议室A",
    "priority": "high",
    "status": "pending",
    "isAllDay": false,
    "recurrenceRule": null,
    "tags": [],
    "createdAt": "2025-12-28T00:00:00.000Z",
    "updatedAt": "2025-12-28T00:00:00.000Z"
  }
}
```

---

### 7. 创建日程

**接口**: `POST /api/schedules`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求体**:
```json
{
  "title": "团队会议",
  "description": "讨论项目进度",
  "startTime": "2025-12-28T10:00:00.000Z",
  "endTime": "2025-12-28T11:00:00.000Z",
  "location": "会议室A",
  "priority": "high",
  "status": "pending",
  "isAllDay": false,
  "recurrenceRule": null,
  "tagIds": []
}
```

**字段说明**:
- `title` (必填): 日程标题
- `description` (可选): 日程描述
- `startTime` (必填): 开始时间 (ISO-8601)
- `endTime` (必填): 结束时间 (ISO-8601)
- `location` (可选): 地点
- `priority` (必填): 优先级 (`low` | `medium` | `high` | `urgent`)
- `status` (可选): 状态，默认 `pending`
- `isAllDay` (可选): 是否全天，默认 `false`
- `recurrenceRule` (可选): 重复规则
- `tagIds` (可选): 标签ID数组

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "title": "团队会议",
    "description": "讨论项目进度",
    "startTime": "2025-12-28T10:00:00.000Z",
    "endTime": "2025-12-28T11:00:00.000Z",
    "location": "会议室A",
    "priority": "high",
    "status": "pending",
    "isAllDay": false,
    "recurrenceRule": null,
    "tags": [],
    "createdAt": "2025-12-28T00:00:00.000Z",
    "updatedAt": "2025-12-28T00:00:00.000Z"
  }
}
```

---

### 8. 更新日程

**接口**: `PUT /api/schedules/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求体**: (所有字段都是可选的)
```json
{
  "title": "更新后的标题",
  "status": "completed"
}
```

**响应**: 与创建日程响应相同

---

### 9. 删除日程

**接口**: `DELETE /api/schedules/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "success": true,
  "message": "日程删除成功"
}
```

---

### 10. 检查时间冲突

**接口**: `GET /api/schedules/conflicts/check`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**查询参数**:
- `startTime` (必填): 开始时间 (ISO-8601)
- `endTime` (必填): 结束时间 (ISO-8601)
- `excludeScheduleId` (可选): 排除的日程ID (用于编辑时)

**响应**:
```json
{
  "success": true,
  "data": {
    "hasConflicts": true,
    "conflicts": [
      {
        "id": "uuid",
        "title": "已有会议",
        "startTime": "2025-12-28T10:00:00.000Z",
        "endTime": "2025-12-28T11:00:00.000Z",
        "priority": "high"
      }
    ]
  }
}
```

---

### 11. 获取日程统计

**接口**: `GET /api/schedules/stats`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "total": 25,
    "pending": 10,
    "completed": 15,
    "today": 3,
    "thisWeek": 8,
    "highPriority": 5
  }
}
```

---

## AI 智能功能 API

### 12. AI 冲突分析

**接口**: `POST /api/ai/analyze-conflicts`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "conflicts": [
      {
        "scheduleIds": ["uuid1", "uuid2"],
        "type": "time_overlap",
        "severity": "high",
        "description": "\"会议A\" 和 \"会议B\" 时间冲突"
      }
    ],
    "suggestions": [
      {
        "scheduleId": "uuid",
        "suggestion": "考虑重新安排时间",
        "reason": "与其他日程冲突"
      }
    ]
  }
}
```

---

### 13. AI 时间推荐

**接口**: `POST /api/ai/suggest-time`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求体**:
```json
{
  "duration": 60
}
```

**字段说明**:
- `duration` (必填): 所需时长（分钟）

**响应**:
```json
{
  "success": true,
  "data": {
    "recommendedSlots": [
      {
        "startTime": "2025-12-28T09:00:00.000Z",
        "endTime": "2025-12-28T10:00:00.000Z",
        "score": 0.9,
        "reason": "上午黄金时间段，无冲突"
      },
      {
        "startTime": "2025-12-28T14:00:00.000Z",
        "endTime": "2025-12-28T15:00:00.000Z",
        "score": 0.8,
        "reason": "下午空闲时段"
      }
    ]
  }
}
```

---

### 14. AI 日程优化

**接口**: `POST /api/ai/optimize-schedule`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求体**:
```json
{
  "startDate": "2025-12-28T00:00:00.000Z",
  "endDate": "2025-12-29T00:00:00.000Z"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "optimizations": [
      {
        "scheduleId": "uuid",
        "currentTime": "2025-12-28T16:00:00.000Z",
        "suggestedTime": "2025-12-28T09:00:00.000Z",
        "reason": "高优先级任务建议在上午完成",
        "impact": "提高效率"
      }
    ],
    "overallScore": 0.85
  }
}
```

---

## 标签管理 API

### 15. 获取标签列表

**接口**: `GET /api/tags`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "工作",
      "color": "#ff5722",
      "createdAt": "2025-12-28T00:00:00.000Z"
    }
  ]
}
```

---

### 16. 创建标签

**接口**: `POST /api/tags`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**请求体**:
```json
{
  "name": "工作",
  "color": "#ff5722"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "工作",
    "color": "#ff5722",
    "createdAt": "2025-12-28T00:00:00.000Z"
  }
}
```

---

### 17. 删除标签

**接口**: `DELETE /api/tags/:id`

**请求头**:
```
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "success": true,
  "message": "标签删除成功"
}
```

---

## 错误响应格式

所有错误响应遵循以下格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  }
}
```

### 常见错误码

- `UNAUTHORIZED`: 未授权，需要登录
- `FORBIDDEN`: 权限不足
- `NOT_FOUND`: 资源不存在
- `VALIDATION_ERROR`: 请求参数验证失败
- `INTERNAL_ERROR`: 服务器内部错误
- `EMAIL_EXISTS`: 邮箱已存在
- `INVALID_CREDENTIALS`: 邮箱或密码错误
- `TOKEN_EXPIRED`: Token已过期
- `INVALID_TOKEN`: 无效的Token

---

## 使用示例

### cURL 示例

**注册用户**:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "测试用户"
  }'
```

**创建日程**:
```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "团队会议",
    "startTime": "2025-12-28T10:00:00.000Z",
    "endTime": "2025-12-28T11:00:00.000Z",
    "priority": "high"
  }'
```

**检查冲突**:
```bash
curl -X GET "http://localhost:3000/api/schedules/conflicts/check?startTime=2025-12-28T10:00:00.000Z&endTime=2025-12-28T11:00:00.000Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 注意事项

1. **时间格式**: 所有时间都使用 ISO-8601 格式 (UTC时区)
2. **认证**: 除了注册和登录接口，其他所有接口都需要在请求头中携带有效的 JWT Token
3. **Token有效期**: 
   - Access Token: 15分钟
   - Refresh Token: 7天
4. **分页**: 默认每页返回50条记录，最大100条
5. **速率限制**: 建议实现速率限制以防止滥用

---

## 版本信息

- **当前版本**: v1.0.0
- **更新日期**: 2025-12-28
- **维护者**: Kilo Code