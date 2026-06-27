import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/store';
import { AppRenderer } from '@/renderer/AppRenderer';
import { Code2, Layers, Eye, Database, GitBranch, RotateCcw, ChevronDown, Download, Upload } from 'lucide-react';
import { DiffView } from './DiffView';
import { DataPanel } from './DataPanel';
import { CodePanel } from './CodePanel';

export function PreviewPanel() {
  const versions = useStore((s) => s.versions);
  const previewVersionId = useStore((s) => s.previewVersionId);
  const records = useStore((s) => s.records);
  const rightPanel = useStore((s) => s.rightPanel);
  const setRightPanel = useStore((s) => s.setRightPanel);
  const switchPreviewVersion = useStore((s) => s.switchPreviewVersion);
  const restoreVersion = useStore((s) => s.restoreVersion);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const toast = useStore((s) => s.toast);
  const project = useStore((s) =>
    s.projects.find((p) => p.id === s.currentProjectId),
  );

  const [versionOpen, setVersionOpen] = useState(false);
  const versionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!versionOpen) return;
    const onClick = (e: MouseEvent) => {
      if (versionMenuRef.current && !versionMenuRef.current.contains(e.target as Node)) {
        setVersionOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [versionOpen]);

  if (!project) {
    return (
      <section className="flex h-full w-[480px] flex-col border-l border-paper-border bg-paper-card/40 backdrop-blur">
        <div className="border-b border-paper-border px-5 py-3">
          <span className="text-sm font-medium text-ink-900">Preview</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 text-3xl">⚛️</div>
          <div className="text-sm font-medium text-ink-700">还没有选择项目</div>
          <div className="mt-1 text-xs text-ink-500">
            在左侧从模板创建，或在中间输入需求
            <br />让 Agent 帮你生成一个应用。
          </div>
        </div>
      </section>
    );
  }

  const current = versions.find((v) => v.id === previewVersionId);
  const currentIdx = versions.findIndex((v) => v.id === previewVersionId);
  const prev = currentIdx > 0 ? versions[currentIdx - 1] : null;

  const tabs = [
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'diff', label: 'Diff', icon: GitBranch },
    { id: 'data', label: 'Data', icon: Database },
  ] as const;

  function onExport() {
    const data = exportData();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project!.name.replace(/\s+/g, '_')}.atomforge.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('已导出 JSON', 'success');
  }

  function onImport() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const json = JSON.parse(text);
        await importData(json);
      } catch (e) {
        toast('导入失败：' + (e as Error).message, 'error');
      }
    };
    inp.click();
  }

  const isCurrentLatest = currentIdx === versions.length - 1;

  return (
    <section className="flex h-full w-[520px] min-w-[420px] shrink-0 flex-col border-l border-paper-border bg-paper-card/40 backdrop-blur xl:w-[560px]">
      <div className="flex items-center gap-2 border-b border-paper-border bg-paper-card/50 px-4 py-2.5">
        <Layers size={14} className="text-ink-500" />
        <div className="flex items-center gap-1.5 text-sm text-ink-900">
          <span className="font-medium">{project.name}</span>
        </div>
        <div className="relative" ref={versionMenuRef}>
          <button
            className="chip cursor-pointer hover:border-paper-borderStrong hover:bg-paper-subtle"
            onClick={() => setVersionOpen((v) => !v)}
          >
            v{currentIdx + 1}/{versions.length}
            <ChevronDown size={10} />
          </button>
          {versionOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-72 overflow-auto rounded-lg border border-paper-border bg-paper-card p-1 shadow-xl">
              {versions.slice().reverse().map((v, ri) => {
                const realIdx = versions.length - 1 - ri;
                const active = v.id === previewVersionId;
                return (
                  <div
                    key={v.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                      active ? 'bg-atom-600/15 text-atom-300' : 'text-ink-700 hover:bg-paper-subtle'
                    }`}
                    onClick={() => {
                      switchPreviewVersion(v.id);
                      setVersionOpen(false);
                    }}
                  >
                    <span className="mt-0.5 chip text-[10px]">v{realIdx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{v.changeSummary || v.instruction}</div>
                      <div className="text-[10px] text-ink-500">{new Date(v.createdAt).toLocaleString()}</div>
                    </div>
                    {!active && realIdx !== versions.length - 1 && (
                      <button
                        className="btn-icon text-ink-500 hover:text-emerald-400"
                        title="恢复到该版本"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreVersion(v.id);
                          setVersionOpen(false);
                        }}
                      >
                        <RotateCcw size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {!isCurrentLatest && (
          <span className="chip border-amber-400/40 bg-amber-500/10 text-[10px] text-amber-300">查看历史</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button className="btn-icon" onClick={onImport} title="导入 JSON"><Upload size={14} /></button>
          <button className="btn-icon" onClick={onExport} title="导出 JSON"><Download size={14} /></button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-paper-border bg-paper-card/30 px-2 py-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = rightPanel === t.id;
          return (
            <button
              key={t.id}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition ${
                active
                  ? 'bg-atom-600 text-white shadow-soft'
                  : 'text-ink-600 hover:bg-white/[0.05] hover:text-ink-900'
              }`}
              onClick={() => setRightPanel(t.id)}
            >
              <Icon size={12} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="relative flex-1 overflow-hidden p-3">
        {!current ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-500">无可预览的版本</div>
        ) : rightPanel === 'preview' ? (
          <AppRenderer schema={current.schema} records={records} />
        ) : rightPanel === 'code' ? (
          <CodePanel schema={current.schema} />
        ) : rightPanel === 'diff' ? (
          <DiffView prev={prev?.schema ?? null} next={current.schema} />
        ) : (
          <DataPanel records={records} schema={current.schema} />
        )}
      </div>
    </section>
  );
}
