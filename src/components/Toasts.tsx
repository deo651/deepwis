import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/store';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const color =
          t.kind === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : t.kind === 'error'
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-paper-border bg-white text-ink-800';
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertTriangle : Info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur ${color}`}
          >
            <Icon size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1">{t.text}</div>
            <button className="btn-icon" onClick={() => dismiss(t.id)}>
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
