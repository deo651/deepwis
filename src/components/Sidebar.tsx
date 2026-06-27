import { useState } from 'react';
import { Plus, Trash2, Sparkles, FileCode2, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { useStore } from '@/store/store';
import { TEMPLATES, type Template } from '@/templates/templates';

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(ts).toLocaleDateString();
}

interface Props {
  onPickTemplate(t: Template): void;
}

export function Sidebar({ onPickTemplate }: Props) {
  const projects = useStore((s) => s.projects);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const selectProject = useStore((s) => s.selectProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const renameProject = useStore((s) => s.renameProject);
  const llmAvailable = useStore((s) => s.llmAvailable);
  const preferLLM = useStore((s) => s.preferLLM);
  const setPreferLLM = useStore((s) => s.setPreferLLM);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-paper-border bg-white/70 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-paper-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-atom-100 text-atom-600">
          <Sparkles size={16} />
        </div>
        <div>
          <div className="text-sm font-semibold text-ink-900">AtomForge</div>
          <div className="text-[10px] text-ink-500">AI App Builder Demo</div>
        </div>
      </div>

      <div className="px-3 py-3">
        <button
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-paper-border bg-white px-3 py-2 text-sm font-medium text-ink-700 shadow-soft transition hover:border-paper-borderStrong hover:bg-paper-subtle hover:text-ink-900"
          onClick={() => selectProject(null)}
        >
          <Plus size={14} />新项目
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {projects.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-ink-500">
            还没有项目。
            <br />从下方模板或在右侧输入需求开始 →
          </div>
        )}
        {projects.map((p) => {
          const active = p.id === currentProjectId;
          return (
            <div
              key={p.id}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                active
                  ? 'bg-atom-50 text-atom-700 ring-1 ring-atom-200'
                  : 'text-ink-700 hover:bg-ink-900/[0.04] hover:text-ink-900'
              }`}
              onClick={() => editingId !== p.id && selectProject(p.id)}
              role="button"
            >
              <span className="text-base">{p.emoji ?? '⚛️'}</span>
              {editingId === p.id ? (
                <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    className="flex-1 rounded border border-atom-400 bg-white px-2 py-1 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-atom-500/20"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingName.trim()) renameProject(p.id, editingName.trim());
                        setEditingId(null);
                      } else if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button
                    className="btn-icon"
                    onClick={() => {
                      if (editingName.trim()) renameProject(p.id, editingName.trim());
                      setEditingId(null);
                    }}
                  ><Check size={12} /></button>
                  <button className="btn-icon" onClick={() => setEditingId(null)}><X size={12} /></button>
                </div>
              ) : (
                <>
                  <div className="flex-1 truncate" title={p.name}>
                    <div className="truncate">{p.name}</div>
                    <div className="truncate text-[10px] text-ink-400">{formatRelative(p.updatedAt)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(p.id);
                        setEditingName(p.name);
                      }}
                      title="重命名"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      className="btn-icon hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`确认删除「${p.name}」？此操作不可恢复。`)) deleteProject(p.id);
                      }}
                      title="删除"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-paper-border px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-ink-500">模板市场</div>
          <span className="chip">5 个</span>
        </div>
        <div className="space-y-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="flex w-full items-start gap-2 rounded-lg border border-paper-border bg-white px-2.5 py-2 text-left text-xs text-ink-700 shadow-soft transition hover:border-atom-300 hover:bg-atom-50 hover:text-ink-900"
              onClick={() => onPickTemplate(t)}
              title={t.description}
            >
              <FileCode2 size={12} className="mt-0.5 shrink-0 text-ink-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.title}</div>
                <div className="line-clamp-2 text-[10px] text-ink-500">{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-paper-border px-3 py-3">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={preferLLM && llmAvailable}
            disabled={!llmAvailable}
            onChange={(e) => setPreferLLM(e.target.checked)}
          />
          <div className="text-[11px] leading-tight">
            <div className={`flex items-center gap-1.5 font-medium ${llmAvailable ? 'text-ink-900' : 'text-ink-500'}`}>
              使用真实 LLM
              {llmAvailable && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" title="已就绪" />
              )}
            </div>
            <div className="mt-0.5 text-ink-500">
              {llmAvailable
                ? '已检测到 .env，调用真实模型'
                : '未配置 .env，将使用 DemoProvider'}
            </div>
            {llmAvailable && preferLLM && (
              <div className="mt-1 flex items-start gap-1 text-amber-700">
                <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                <span className="leading-tight">Key 在前端 bundle 中，请勿公开部署</span>
              </div>
            )}
            {!llmAvailable && (
              <div className="mt-1 flex items-center gap-1 text-amber-700/90">
                <AlertTriangle size={10} />
                <span>可在 .env 中填入 VITE_LLM_*</span>
              </div>
            )}
          </div>
        </label>
      </div>
    </aside>
  );
}
