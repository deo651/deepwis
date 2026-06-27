import type { GeneratedApp } from '@/types/schema';
import { DemoAgentProvider } from './demoProvider';
import { LLMAgentProvider, readLLMConfigFromEnv } from './llmProvider';
import type { AgentProvider, AgentRunContext } from './provider';

export interface RunResult {
  output: GeneratedApp;
  /** 实际使用的 provider */
  providerId: 'demo' | 'llm';
  /** 如果尝试了 LLM 但被回退，说明原因 */
  fallbackReason?: string;
}

const demo = new DemoAgentProvider();

function getLLM(): AgentProvider | null {
  const cfg = readLLMConfigFromEnv();
  if (!cfg) return null;
  return new LLMAgentProvider(cfg);
}

export function hasLLMConfigured(): boolean {
  return getLLM() != null;
}

/**
 * 默认 generate 入口：
 * - 若 `preferLLM` 且环境配置完整，则优先尝试 LLM。
 * - 任意异常 → 自动回退 Demo，附带 fallbackReason。
 */
export async function runGenerate(
  requirement: string,
  ctx: AgentRunContext,
  preferLLM: boolean,
): Promise<RunResult> {
  const llm = preferLLM ? getLLM() : null;
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
  const llm = preferLLM ? getLLM() : null;
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
