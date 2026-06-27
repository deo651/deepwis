import { useMemo } from 'react';
import { diffLines } from 'diff';
import type { AppSchema } from '@/types/schema';

interface Props {
  prev: AppSchema | null;
  next: AppSchema;
}

export function DiffView({ prev, next }: Props) {
  const prevText = useMemo(() => (prev ? JSON.stringify(prev, null, 2) : ''), [prev]);
  const nextText = useMemo(() => JSON.stringify(next, null, 2), [next]);

  const parts = useMemo(() => diffLines(prevText, nextText), [prevText, nextText]);

  if (!prev) {
    return (
      <div className="h-full overflow-auto rounded-xl border border-paper-border bg-white p-4 font-mono text-xs shadow-soft">
        <div className="mb-2 text-ink-500">这是首版，没有可对比的旧 schema。展示当前 schema 全文：</div>
        <pre className="whitespace-pre-wrap text-emerald-700">{nextText}</pre>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto rounded-xl border border-paper-border bg-white p-4 font-mono text-xs leading-relaxed shadow-soft">
      {parts.map((part, i) => {
        const lines = part.value.split('\n');
        // diffLines 会以 \n 结束 split 产生空尾，去掉
        if (lines[lines.length - 1] === '') lines.pop();
        const cls = part.added
          ? 'text-emerald-700 bg-emerald-50'
          : part.removed
          ? 'text-red-700 bg-red-50 line-through'
          : 'text-ink-700';
        const prefix = part.added ? '+' : part.removed ? '-' : ' ';
        return (
          <div key={i} className={cls}>
            {lines.map((l, j) => (
              <div key={j} className="whitespace-pre">{prefix} {l}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
