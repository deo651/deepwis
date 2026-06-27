import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin, type ViteDevServer, type PreviewServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * 服务端 LLM 代理 plugin。
 *
 * 安全约束：
 * - `.env` 中的 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL（兼容旧 VITE_LLM_*）
 *   仅在 Node 进程内存中存在，**绝不**会被打包进前端 bundle。
 * - 前端通过同源 fetch `/api/llm/status` 探测可用性，通过 `/api/llm/chat`
 *   调用 LLM（body: { system, user }），服务器侧代为转发。
 * - dev (`vite`) 与 preview (`vite preview`) 两种模式下均注册代理。
 * - 浏览器永远不接触 Key。
 */
function llmProxyPlugin(): Plugin {
  return {
    name: 'atomforge-llm-proxy',
    configureServer(server: ViteDevServer) {
      const envDir = server.config.envDir ?? process.cwd();
      attachProxy(server.middlewares, envDir);
    },
    configurePreviewServer(server: PreviewServer) {
      attachProxy(server.middlewares, process.cwd());
    },
  };
}

interface MiniConnect {
  use(path: string, handler: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void): unknown;
}

function attachProxy(middlewares: MiniConnect, envDir: string) {
  // 优先读 LLM_*（不带 VITE_ 前缀，保证绝不进 bundle），兼容旧 VITE_LLM_*
  const env = loadEnv('', envDir, '');
  const baseUrl = (env.LLM_BASE_URL || env.VITE_LLM_BASE_URL || '').trim();
  const apiKey = (env.LLM_API_KEY || env.VITE_LLM_API_KEY || '').trim();
  const model = (env.LLM_MODEL || env.VITE_LLM_MODEL || '').trim();
  const configured = !!(baseUrl && apiKey && model);

  middlewares.use('/api/llm/status', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ available: configured, model: configured ? model : '' }));
  });

  middlewares.use('/api/llm/chat', async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    if (!configured) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'LLM 未在服务器端配置（.env 缺 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL）' }));
      return;
    }

    let payload: { system?: unknown; user?: unknown };
    try {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'body 非合法 JSON' }));
      return;
    }
    const system = typeof payload.system === 'string' ? payload.system : '';
    const user = typeof payload.user === 'string' ? payload.user : '';
    if (!system || !user) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'body 必须包含 system 与 user 字符串' }));
      return;
    }

    const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'api-key': apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        res.statusCode = upstream.status;
        res.end(JSON.stringify({ error: `LLM HTTP ${upstream.status}: ${text.slice(0, 200)}` }));
        return;
      }
      const data = (await upstream.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      if (!content) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: 'LLM 返回空内容' }));
        return;
      }
      res.end(JSON.stringify({ content }));
    } catch (e) {
      clearTimeout(timer);
      const err = e as Error;
      res.statusCode = 502;
      const reason = err.name === 'AbortError' ? 'LLM 调用超过 60s 超时' : err.message;
      res.end(JSON.stringify({ error: reason }));
    }
  });
}

export default defineConfig({
  plugins: [react(), llmProxyPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 5173,
    strictPort: false,
  },
  // 双保险：即使前端代码意外引用了旧的 import.meta.env.VITE_LLM_*，
  // 也强制替换为空字符串。
  // 真正的密钥来源是服务器端的 LLM_* 环境变量（见 llmProxyPlugin）。
  define: {
    'import.meta.env.VITE_LLM_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_LLM_API_KEY': JSON.stringify(''),
    'import.meta.env.VITE_LLM_MODEL': JSON.stringify(''),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
  },
});
