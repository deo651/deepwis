import { Atom, Github, Cloud, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useStore } from '@/store/store';

export function Topbar() {
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.currentProjectId),
  );
  const llmAvailable = useStore((s) => s.llmAvailable);
  const preferLLM = useStore((s) => s.preferLLM);
  const agentRunning = useStore((s) => s.agentRunning);

  const usingLLM = llmAvailable && preferLLM;

  return (
    <header className="flex h-12 items-center gap-3 border-b border-paper-border bg-paper-card/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2 text-ink-900">
        <Atom size={16} className="text-atom-600" />
        <span className="text-sm font-semibold">AtomForge</span>
        <span className="chip text-[10px]">Demo</span>
      </div>
      <div className="ml-2 hidden items-center gap-1 text-xs text-ink-500 md:flex">
        <span className="text-ink-400">/</span>
        <span className="truncate">{project ? project.name : '未选择项目'}</span>
        {project && <span className="chip ml-1 text-[10px]">{agentRunning ? '保存中…' : '已保存'}</span>}
      </div>
      <div className="ml-auto flex items-center gap-2 text-xs">
        <span
          className={`chip ${
            usingLLM ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : 'text-ink-600'
          }`}
        >
          {usingLLM ? (
            <>
              <Cloud size={11} />LLM 模式
            </>
          ) : (
            <>
              <ShieldCheck size={11} />Demo 模式
            </>
          )}
        </span>
        {preferLLM && !llmAvailable && (
          <span className="chip border-amber-400/40 bg-amber-500/10 text-amber-300">
            <ShieldAlert size={11} />未配置 .env
          </span>
        )}
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="btn-icon"
          title="GitHub"
        >
          <Github size={14} />
        </a>
      </div>
    </header>
  );
}
