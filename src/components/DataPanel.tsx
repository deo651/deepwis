import type { AppRecord } from '@/types/project';
import type { AppSchema } from '@/types/schema';

interface Props {
  schema: AppSchema;
  records: AppRecord[];
}

export function DataPanel({ schema, records }: Props) {
  return (
    <div className="h-full overflow-auto rounded-xl border border-paper-border bg-white shadow-soft">
      <div className="sticky top-0 z-10 border-b border-paper-border bg-white/95 px-3 py-2 text-[11px] uppercase tracking-wider text-ink-500 backdrop-blur">
        Records · {schema.entity.label}（{records.length} 条，存储于 IndexedDB）
      </div>
      {records.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-ink-500">
          这里会显示生成应用中产生的真实数据。<br />刷新页面后，数据仍然保留。
        </div>
      ) : (
        <pre className="overflow-auto whitespace-pre bg-paper-muted/40 p-4 font-mono text-xs leading-relaxed text-ink-800">
{JSON.stringify(records, null, 2)}
        </pre>
      )}
    </div>
  );
}
