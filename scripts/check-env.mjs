// 通过 Vite 的 dev server 模拟一次模块加载，确认 import.meta.env 已正确注入。
// 这里不连真实 LLM，仅打印环境变量是否可见。

import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  optimizeDeps: { disabled: true },
  server: { middlewareMode: true },
  plugins: [],
});
await server.pluginContainer.buildStart({});

// 用 Vite 的 SSR loader 加载一个小模块，里面读取 import.meta.env
const code = `
export const env = {
  base: import.meta.env.VITE_LLM_BASE_URL ?? null,
  model: import.meta.env.VITE_LLM_MODEL ?? null,
  hasKey: !!import.meta.env.VITE_LLM_API_KEY,
};
`;
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
mkdirSync('.vite-tmp', { recursive: true });
writeFileSync('.vite-tmp/probe.js', code);
try {
  const mod = await server.ssrLoadModule('/.vite-tmp/probe.js');
  console.log('VITE_LLM_BASE_URL:', mod.env.base);
  console.log('VITE_LLM_MODEL:   ', mod.env.model);
  console.log('VITE_LLM_API_KEY: ', mod.env.hasKey ? '(present, redacted)' : '(missing)');
} finally {
  await server.close();
  rmSync('.vite-tmp', { recursive: true, force: true });
}
