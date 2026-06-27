import type { GeneratedApp } from '@/types/schema';
import { DemoAgentProvider } from './demoProvider';
import { LLMAgentProvider, readLLMConfigFromServer } from './llmProvider';
import type { AgentProvider, AgentRunContext } from './provider';

export interface RunResult {
  output: GeneratedApp;
  /** 实际使用的 provider */
  providerId: 'demo' | 'llm';
  /** 如果尝试了 LLM 但被回退，说明原因 */
  fallbackReason?: string;
}

const demo = new DemoAgentProvider();

/**
 * 异步获取一个可用的 LLM provider。
 *
 * 关键安全约束：
 * - LLM 的 API Key / base URL 仅存在于服务器进程（vite plugin），浏览器一律不持有；
 * - 此处通过同源 `/api/llm/status` 探测可用性，再交由 `LLMAgentProvider` 走代理 `/api/llm/chat`。
 */
async function getLLM(): Promise<AgentProvider | null> {
  const cfg = await readLLMConfigFromServer();
  if (!cfg) return null;
  return new LLMAgentProvider(cfg);
}

/**
 * 异步检查服务器端是否已启用 LLM。供 store 在 bootstrap 时调用。
 */
export async function checkLLMAvailable(): Promise<{ available: boolean; model?: string }> {
  const cfg = await readLLMConfigFromServer();
  return cfg ? { available: true, model: cfg.model } : { available: false };
}

/**
 * 默认 generate 入口：
 * - 若 `preferLLM` 且服务器端配置完整，则优先尝试 LLM。
 * - 任意异常 → 自动回退 Demo，附带 fallbackReason。
 */
export async function runGenerate(
  requirement: string,
  ctx: AgentRunContext,
  preferLLM: boolean,
): Promise<RunResult> {
  const llm = preferLLM ? await getLLM() : null;
  if (llm) {
    try {
      const out = await llm.generateApp(requirement, ctx);
      return { output: out, providerId: 'llm' };
    } catch (e) {
      const reason = (e as Error).message || String(e);
      const out = await demo.generateApp(requirement, ctx);
      return { output: out, providerId: 'demo', fallbackReason: reason };
    }
  }
  const out = await demo.generateApp(requirement, ctx);
  return { output: out, providerId: 'demo' };
}

export async function runModify(
  current: GeneratedApp,
  instruction: string,
  ctx: AgentRunContext,
  preferLLM: boolean,
): Promise<RunResult> {
  const llm = preferLLM ? await getLLM() : null;
  if (llm) {
    try {
      const out = await llm.modifyApp(current, instruction, ctx);
      return { output: out, providerId: 'llm' };
    } catch (e) {
      const reason = (e as Error).message || String(e);
      const out = await demo.modifyApp(current, instruction, ctx);
      return { output: out, providerId: 'demo', fallbackReason: reason };
    }
  }
  const out = await demo.modifyApp(current, instruction, ctx);
  return { output: out, providerId: 'demo' };
}

export { DemoAgentProvider, LLMAgentProvider };
export type { AgentProvider, AgentRunContext };
