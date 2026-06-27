import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Sparkles,
  CheckCircle2,
  Loader2,
  Circle,
  ChevronDown,
  AlertCircle,
  User,
} from 'lucide-react';
import { useStore } from '@/store/store';
import type { AgentMessage, AgentStep } from '@/types/project';

const QUICK_PROMPTS = [
  '增加深色模式',
  '加上搜索和按分类筛选',
  '加近 7 天完成趋势图',
  '给每条加优先级 P0-P3',
  '把标题改得更简洁',
];

interface Props {
  onStartNewProject(requirement: string): Promise<unknown>;
}

export function AgentWorkspace({ onStartNewProject }: Props) {
  const messages = useStore((s) => s.messages);
  const liveSteps = useStore((s) => s.liveSteps);
  const agentRunning = useStore((s) => s.agentRunning);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const sendModifyInstruction = useStore((s) => s.sendModifyInstruction);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, liveSteps]);

  async function submit() {
    const text = input.trim();
    if (!text || agentRunning) return;
    setInput('');
    if (!currentProjectId) {
      await onStartNewProject(text);
    } else {
      await sendModifyInstruction(text);
    }
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-paper-page/30">
      <div className="flex items-center gap-2 border-b border-paper-border bg-white/50 px-5 py-3 backdrop-blur">
        <Sparkles size={14} className="text-atom-600" />
        <span className="text-sm font-medium text-ink-900">Agent Workspace</span>
        {agentRunning && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-atom-600">
            <Loader2 size={12} className="animate-spin" /> 执行中
          </span>
        )}
        <span className="ml-auto text-xs text-ink-500">
          {currentProjectId ? '继续与 Agent 对话以迭代应用' : '输入一句话需求开始 →'}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {!currentProjectId && messages.length === 0 && <Onboarding />}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {agentRunning && (
          <div className="rounded-xl border border-atom-200 bg-atom-50/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-atom-700">
              <Loader2 size={12} className="animate-spin" /> Agent 正在执行
            </div>
            <StepList steps={liveSteps} />
          </div>
        )}
      </div>

      <div className="border-t border-paper-border bg-white/60 px-5 py-3 backdrop-blur">
        {currentProjectId && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                disabled={agentRunning}
                className="chip transition hover:border-atom-300 hover:bg-atom-50 hover:text-atom-700 disabled:opacity-50"
                onClick={() => setInput(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            className="input-base min-h-[44px] flex-1 resize-none"
            placeholder={currentProjectId ? '继续告诉 Agent 你想改什么...' : '描述一个你想要的小应用，例如：帮我生成一个每日习惯打卡应用，支持添加习惯和统计连续天数。'}
            value={input}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={agentRunning}
          />
          <button
            className="btn-primary h-11"
            disabled={agentRunning || !input.trim()}
            onClick={submit}
            title="⌘ + Enter 发送"
          >
            <Send size={14} />发送
          </button>
        </div>
        <div className="mt-1 text-[10px] text-ink-400">⌘ + Enter 发送 · Esc 关闭弹窗</div>
      </div>
    </section>
  );
}

function Onboarding() {
  return (
    <div className="rounded-2xl border border-paper-border bg-gradient-to-br from-atom-50 via-white to-white p-6 shadow-card">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-atom-600">欢迎使用 AtomForge</div>
      <h1 className="mb-2 text-2xl font-semibold text-ink-900">一句话，生成一个可交互的应用</h1>
      <p className="mb-4 text-sm text-ink-600">
        在左侧选择一个 <span className="font-medium text-ink-900">模板</span>，或在下方输入框中描述你的需求。
        Agent 会通过 <span className="font-medium text-ink-900">理解 / 拆解 / 生成 / 校验 / 启动预览</span> 五个步骤完成生成，
        生成的应用真正可交互、可二次修改、可保存历史版本。
      </p>
      <ul className="space-y-1.5 text-sm text-ink-700">
        <li>• 数据持久化：所有项目 / 版本 / 应用数据均存在浏览器 IndexedDB。</li>
        <li>• 二次修改：发送"加搜索 / 加趋势 / 加优先级"等指令即可生成新版本。</li>
        <li>• 版本管理：支持切换、Diff、一键恢复任意历史版本。</li>
      </ul>
    </div>
  );
}

function StepList({ steps }: { steps: AgentStep[] }) {
  return (
    <ol className="space-y-1.5 text-xs">
      {steps.map((s) => (
        <StepRow key={s.key} step={s} />
      ))}
    </ol>
  );
}

function StepRow({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen(!open)}
        disabled={step.logs.length === 0}
      >
        {step.status === 'running' ? (
          <Loader2 size={12} className="animate-spin text-atom-600" />
        ) : step.status === 'done' ? (
          <CheckCircle2 size={12} className="text-emerald-500" />
        ) : step.status === 'error' ? (
          <AlertCircle size={12} className="text-red-500" />
        ) : (
          <Circle size={12} className="text-ink-300" />
        )}
        <span className={`${step.status === 'done' ? 'text-ink-700' : 'text-ink-500'}`}>{step.label}</span>
        {step.durationMs != null && (
          <span className="text-[10px] text-ink-400">{step.durationMs}ms</span>
        )}
        {step.logs.length > 0 && (
          <ChevronDown size={10} className={`ml-auto text-ink-400 transition ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && step.logs.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-l border-paper-border pl-4 text-[11px] text-ink-500">
          {step.logs.map((l, i) => (
            <li key={i}>· {l}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex items-start justify-end gap-2">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-atom-600 px-3.5 py-2 text-sm text-white shadow-glow">
          {message.content}
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-subtle text-ink-500">
          <User size={14} />
        </div>
      </div>
    );
  }
  if (message.kind === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium">
          <AlertCircle size={12} /> Agent 报告错误
        </div>
        {message.content}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-paper-border bg-white p-3 shadow-card">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-atom-100 text-atom-600">
          <Sparkles size={11} />
        </div>
        <span className="font-medium text-ink-900">Agent</span>
        {message.provider && (
          <span className="chip text-[10px]">{message.provider === 'llm' ? 'LLM' : 'Demo'}</span>
        )}
        {message.fallbackReason && (
          <span className="chip border-amber-300 bg-amber-50 text-[10px] text-amber-700">已回退：{message.fallbackReason.slice(0, 28)}</span>
        )}
        {message.versionId && (
          <span className="chip border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">已生成新版本</span>
        )}
      </div>
      {message.content && <div className="text-sm text-ink-700">{message.content}</div>}
      {message.steps && message.steps.length > 0 && (
        <div className="mt-2">
          <StepList steps={message.steps} />
        </div>
      )}
    </div>
  );
}
