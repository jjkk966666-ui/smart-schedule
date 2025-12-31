import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

/**
 * 生成随机8位通行证码
 */
function generateRandomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * GET /api/admin/generate-passports
 * 
 * 隐藏的管理员接口，用于生成VIP通行证
 * 
 * 安全校验：URL参数中必须包含正确的 secret
 * 示例：GET /api/admin/generate-passports?secret=your-admin-secret
 * 
 * 功能：
 * - 随机生成5个唯一的8位字符串通行证
 * - 存入数据库 VipPassport 表
 * - 以HTML页面形式显示生成的通行证
 */
router.get('/generate-passports', async (req: Request, res: Response) => {
  try {
    // 安全校验：验证 ADMIN_SECRET
    const { secret } = req.query;
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <title>错误</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
            .error { color: #d32f2f; background: #ffebee; padding: 20px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>⚠️ 服务器配置错误</h2>
            <p>ADMIN_SECRET 环境变量未设置</p>
          </div>
        </body>
        </html>
      `);
    }

    if (secret !== adminSecret) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <title>访问被拒绝</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
            .error { color: #d32f2f; background: #ffebee; padding: 20px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>🔒 访问被拒绝</h2>
            <p>无效的管理员密钥</p>
          </div>
        </body>
        </html>
      `);
    }

    // 生成5个唯一的8位通行证
    const codes: string[] = [];
    const maxAttempts = 50; // 防止无限循环

    for (let i = 0; i < 5; i++) {
      let code: string;
      let isUnique = false;
      let attempts = 0;

      // 确保生成的码是唯一的
      while (!isUnique && attempts < maxAttempts) {
        code = generateRandomCode();
        attempts++;

        // 检查数据库中是否已存在
        const existing = await (prisma as any).vipPassport.findUnique({
          where: { code },
        });

        if (!existing && !codes.includes(code)) {
          isUnique = true;
          codes.push(code);
        }
      }

      if (!isUnique) {
        throw new Error('无法生成唯一的通行证码，请重试');
      }
    }

    // 存入数据库
    for (const code of codes) {
      await (prisma as any).vipPassport.create({
        data: { code },
      });
    }

    // 生成HTML响应
    const codesHtml = codes.map((code, index) => 
      `<li><code>${code}</code></li>`
    ).join('\n');

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VIP通行证生成成功</title>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 40px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            margin: 0;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          h1 { 
            color: #333; 
            margin-bottom: 20px;
            font-size: 24px;
          }
          .success-badge {
            display: inline-block;
            background: #4caf50;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            margin-bottom: 20px;
          }
          ul { 
            list-style: none; 
            padding: 0; 
            margin: 20px 0;
          }
          li { 
            background: #f8f9fa; 
            padding: 15px 20px; 
            margin: 10px 0; 
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          code { 
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 18px; 
            font-weight: bold;
            color: #333;
            letter-spacing: 2px;
          }
          .note {
            background: #fff3e0;
            border: 1px solid #ffcc80;
            padding: 15px;
            border-radius: 8px;
            color: #e65100;
            font-size: 14px;
            margin-top: 20px;
          }
          .timestamp {
            color: #999;
            font-size: 12px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="success-badge">✓ 生成成功</span>
          <h1>🎫 VIP通行证</h1>
          <p>以下是新生成的 ${codes.length} 个通行证码：</p>
          <ul>
            ${codesHtml}
          </ul>
          <div class="note">
            ⚠️ 请妥善保存这些通行证码。每个码只能使用一次，兑换后可获得24小时VIP权限。
          </div>
          <div class="timestamp">
            生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
          </div>
        </div>
      </body>
      </html>
    `;

    return res.send(html);
  } catch (error) {
    console.error('生成通行证失败:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>错误</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
          .error { color: #d32f2f; background: #ffebee; padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>❌ 生成失败</h2>
          <p>${error instanceof Error ? error.message : '未知错误'}</p>
        </div>
      </body>
      </html>
    `);
  }
});

export default router;