import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { AppSchema } from '@/types/schema';

interface Props {
  schema: AppSchema;
}

export function CodePanel({ schema }: Props) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(schema, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_e) {
      // ignore
    }
  }

  return (
    <div className="relative h-full overflow-auto rounded-xl border border-paper-border bg-paper-card shadow-soft">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-paper-border bg-paper-card/95 px-3 py-2 backdrop-blur">
        <span className="text-[11px] uppercase tracking-wider text-ink-500">App Schema (JSON)</span>
        <button className="chip cursor-pointer hover:border-paper-borderStrong hover:bg-paper-subtle" onClick={copy}>
          {copied ? <><Check size={10} />已复制</> : <><Copy size={10} />复制</>}
        </button>
      </div>
      <pre className="overflow-auto whitespace-pre bg-paper-muted/60 p-4 font-mono text-xs leading-relaxed text-ink-800">
{text}
      </pre>
    </div>
  );
}
