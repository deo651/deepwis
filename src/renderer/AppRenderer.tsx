import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  ExternalLink,
  Sun,
  Moon,
  Calendar as CalendarIcon,
  Flag,
} from 'lucide-react';
import type { AppRecord } from '@/types/project';
import type { AppSchema, FieldDef } from '@/types/schema';
import { useStore } from '@/store/store';
import { computeStat, filterAndSearchRecords, isToday, uniqueValues } from './utils';
import { lastNDays, todayISO } from '@/utils/id';
import { StatChart } from './StatChart';

interface Props {
  schema: AppSchema;
  records: AppRecord[];
}

function fieldDefault(field: FieldDef): unknown {
  if (field.default !== undefined) return field.default;
  switch (field.type) {
    case 'number':
      return '';
    case 'boolean':
      return false;
    case 'date':
      return todayISO();
    case 'select':
    case 'priority':
      return field.options?.[0] ?? '';
    default:
      return '';
  }
}

export function AppRenderer({ schema, records }: Props) {
  const upsertRecord = useStore((s) => s.upsertRecord);
  const deleteRecord = useStore((s) => s.deleteRecord);
  const toggleRecordDone = useStore((s) => s.toggleRecordDone);
  const toggleHabitDay = useStore((s) => s.toggleHabitDay);

  const [overrideMode, setOverrideMode] = useState<'light' | 'dark' | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<AppRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setOverrideMode(null);
    setSearch('');
    setFilters({});
    setEditing(null);
    setCreating(false);
  }, [schema.id]);

  useEffect(() => {
    if (!creating && !editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreating(false);
        setEditing(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creating, editing]);

  const themeMode = overrideMode ?? schema.theme.mode;

  const visibleRecords = useMemo(
    () => filterAndSearchRecords(records, schema, search, filters),
    [records, schema, search, filters],
  );

  const isLight = themeMode === 'light';
  const surface = isLight ? 'bg-white text-gray-900' : 'bg-slate-900 text-slate-100';
  const sub = isLight ? 'text-gray-500' : 'text-slate-400';
  const card = isLight ? 'bg-white border border-gray-200' : 'bg-slate-800/70 border border-white/5';
  const inputCls = isLight
    ? 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2'
    : 'w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2';

  const accent = schema.theme.primary;

  function startCreate() {
    const d: Record<string, unknown> = {};
    for (const f of schema.entity.fields) d[f.key] = fieldDefault(f);
    setDraft(d);
    setCreating(true);
    setEditing(null);
  }

  function startEdit(r: AppRecord) {
    const d: Record<string, unknown> = { id: r.id };
    for (const f of schema.entity.fields) d[f.key] = (r as Record<string, unknown>)[f.key] ?? fieldDefault(f);
    setDraft(d);
    setEditing(r);
    setCreating(false);
  }

  async function submit() {
    const missing = schema.entity.fields.find(
      (f) => f.required && (draft[f.key] === undefined || draft[f.key] === '' || draft[f.key] === null),
    );
    if (missing) {
      useStore.getState().toast(`「${missing.label}」是必填项`, 'error');
      return;
    }
    await upsertRecord(draft as Partial<AppRecord>);
    setCreating(false);
    setEditing(null);
  }

  return (
    <div className={`relative flex h-full flex-col overflow-hidden rounded-2xl ${surface} transition-colors`}>
      {/* App Header */}
      <header
        className="flex items-center justify-between gap-3 rounded-t-2xl border-b px-5 py-4"
        style={{
          borderColor: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)',
          background: isLight ? '#fff' : 'transparent',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl shadow-md"
            style={{ background: accent + '22', color: accent }}
          >
            <span>{schema.emoji}</span>
          </div>
          <div>
            <div className="text-base font-semibold leading-tight">{schema.name}</div>
            <div className={`text-xs ${sub}`}>{schema.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {schema.features.themeToggle && (
            <button
              className={`rounded-md p-1.5 ${isLight ? 'hover:bg-gray-100' : 'hover:bg-white/5'}`}
              onClick={() => setOverrideMode(isLight ? 'dark' : 'light')}
              title="切换主题"
            >
              {isLight ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-md transition hover:brightness-110"
            style={{ background: accent }}
            onClick={startCreate}
          >
            <Plus size={14} />
            新建{schema.entity.label}
          </button>
        </div>
      </header>

      {/* Stats */}
      {schema.stats.length > 0 && (
        <div className="grid gap-3 px-5 py-4" style={{ gridTemplateColumns: `repeat(${Math.min(4, schema.stats.length)}, minmax(0, 1fr))` }}>
          {schema.stats.map((s) => {
            const r = computeStat(s, records, schema);
            return (
              <div key={s.key} className={`rounded-xl p-3 ${card}`}>
                <div className={`text-[11px] uppercase tracking-wide ${sub}`}>{s.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-semibold" style={{ color: accent }}>{r.value}</span>
                  {r.subValue && <span className={`text-xs ${sub}`}>{r.subValue}</span>}
                </div>
                {r.chartData && r.chartData.length > 0 && (
                  <div className="mt-2 h-20">
                    <StatChart kind={s.kind} data={r.chartData} color={accent} isLight={isLight} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Search + Filters */}
      {(schema.features.search || (schema.features.filters?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3" style={{ borderColor: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)' }}>
          {schema.features.search && (
            <div className="relative max-w-xs flex-1">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${sub}`} />
              <input
                className={`${inputCls} pl-8`}
                placeholder={`搜索${schema.entity.pluralLabel}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ['--tw-ring-color' as any]: accent + '55' }}
              />
            </div>
          )}
          {schema.features.filters?.map((f) => {
            const field = schema.entity.fields.find((x) => x.key === f.field);
            const options =
              field?.options ?? uniqueValues(records, f.field);
            return (
              <select
                key={f.field}
                className={inputCls + ' w-auto min-w-[120px]'}
                value={filters[f.field] ?? ''}
                onChange={(e) => setFilters({ ...filters, [f.field]: e.target.value })}
              >
                <option value="">{f.label}：全部</option>
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            );
          })}
        </div>
      )}

      {/* List */}
      <main className="flex-1 overflow-auto px-5 py-4">
        {visibleRecords.length === 0 ? (
          <EmptyState
            schema={schema}
            isLight={isLight}
            accent={accent}
            onCreate={startCreate}
            hasFilter={!!search || Object.values(filters).some((v) => !!v)}
          />
        ) : (
          <ul className="space-y-2">
            {visibleRecords.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                schema={schema}
                isLight={isLight}
                accent={accent}
                onEdit={() => startEdit(r)}
                onDelete={() => deleteRecord(r.id)}
                onToggleDone={() => toggleRecordDone(r.id)}
                onToggleHabitDay={(d) => toggleHabitDay(r.id, d)}
              />
            ))}
          </ul>
        )}
      </main>

      {/* Edit Modal */}
      {(creating || editing) && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center" onClick={() => { setCreating(false); setEditing(null); }}>
          <div
            className={`w-full max-w-md rounded-2xl p-5 shadow-2xl ${isLight ? 'bg-white' : 'bg-slate-900 border border-white/10'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold">
                {editing ? `编辑${schema.entity.label}` : `新建${schema.entity.label}`}
              </div>
              <button className={`btn-icon ${isLight ? 'text-gray-500' : ''}`} onClick={() => { setCreating(false); setEditing(null); }}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {schema.entity.fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={draft[f.key]}
                  onChange={(v) => setDraft({ ...draft, [f.key]: v })}
                  isLight={isLight}
                  inputCls={inputCls}
                  accent={accent}
                />
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className={`${isLight ? 'rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50' : 'btn-ghost'}`}
                onClick={() => { setCreating(false); setEditing(null); }}
              >取消</button>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-md hover:brightness-110"
                style={{ background: accent }}
                onClick={submit}
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ schema, isLight, accent, onCreate, hasFilter }: {
  schema: AppSchema; isLight: boolean; accent: string; onCreate: () => void; hasFilter: boolean;
}) {
  return (
    <div className={`flex h-full flex-col items-center justify-center rounded-xl border border-dashed py-10 ${isLight ? 'border-gray-200 text-gray-500' : 'border-white/10 text-slate-300'}`}>
      <div className="mb-3 text-3xl" style={{ filter: 'saturate(1.2)' }}>{schema.emoji}</div>
      <div className="text-sm">
        {hasFilter ? '没有符合条件的内容' : `还没有${schema.entity.pluralLabel}，从添加第一条开始吧`}
      </div>
      <button
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-md transition hover:brightness-110"
        style={{ background: accent }}
        onClick={onCreate}
      >
        <Plus size={14} /> 新建{schema.entity.label}
      </button>
    </div>
  );
}

function RecordCard({
  record, schema, isLight, accent, onEdit, onDelete, onToggleDone, onToggleHabitDay,
}: {
  record: AppRecord;
  schema: AppSchema;
  isLight: boolean;
  accent: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
  onToggleHabitDay: (d: string) => void;
}) {
  const card = isLight
    ? 'bg-white border border-gray-200 hover:border-gray-300'
    : 'bg-slate-800/60 border border-white/[0.05] hover:border-white/10';
  const sub = isLight ? 'text-gray-500' : 'text-slate-400';
  const summaryFields = schema.entity.fields.filter((f) => f.showInSummary);
  const titleField = summaryFields[0] ?? schema.entity.fields[0];
  const otherFields = summaryFields.slice(1);
  const days = lastNDays(7);

  return (
    <li className={`group rounded-xl px-4 py-3 transition ${card}`}>
      <div className="flex items-start gap-3">
        {schema.entity.completable && !schema.entity.streakable && (
          <button
            onClick={onToggleDone}
            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${record.done ? '' : 'border-current opacity-40 hover:opacity-100'}`}
            style={record.done ? { background: accent, borderColor: accent, color: '#fff' } : undefined}
            title="标记完成"
          >
            {record.done && <Check size={12} strokeWidth={3} />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 ${record.done ? `line-through ${sub}` : ''}`}>
            <span className="truncate text-sm font-medium">{String((record as Record<string, unknown>)[titleField.key] ?? '')}</span>
            {otherFields.map((f) => {
              const v = (record as Record<string, unknown>)[f.key];
              if (v === undefined || v === null || v === '') return null;
              if (f.type === 'priority') {
                return (
                  <span key={f.key} className="chip" style={{ background: accent + '22', color: accent, borderColor: accent + '40' }}>
                    <Flag size={10} />{String(v)}
                  </span>
                );
              }
              if (f.type === 'date') {
                return (
                  <span key={f.key} className={`chip ${sub}`}>
                    <CalendarIcon size={10} />{String(v)}{isToday(String(v)) && ' · 今天'}
                  </span>
                );
              }
              if (f.type === 'number') {
                const unit = schema.entity.amountField === f.key ? '¥' : '';
                return <span key={f.key} className="chip" style={{ background: accent + '22', color: accent }}>{unit}{Number(v).toFixed(2)}</span>;
              }
              if (f.type === 'tag') {
                const tags = String(v).split(',').map((x) => x.trim()).filter(Boolean);
                return (
                  <span key={f.key} className="flex flex-wrap items-center gap-1">
                    {tags.map((t) => <span key={t} className="chip">#{t}</span>)}
                  </span>
                );
              }
              if (f.type === 'url') {
                return (
                  <a key={f.key} href={String(v)} target="_blank" rel="noreferrer" className="chip hover:underline" style={{ color: accent }}>
                    <ExternalLink size={10} />打开
                  </a>
                );
              }
              if (f.type === 'select') {
                return <span key={f.key} className="chip">{String(v)}</span>;
              }
              if (f.type === 'longtext') {
                const text = String(v);
                if (!text) return null;
                return <span key={f.key} className={`truncate text-xs ${sub}`}>· {text.slice(0, 60)}{text.length > 60 ? '…' : ''}</span>;
              }
              return null;
            })}
          </div>
          {schema.entity.streakable && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {days.map((d) => {
                const done = (record.completedDates ?? []).includes(d);
                const today = isToday(d);
                return (
                  <button
                    key={d}
                    onClick={() => onToggleHabitDay(d)}
                    title={d}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-medium transition ${today ? 'ring-2' : ''}`}
                    style={{
                      background: done ? accent : isLight ? '#f3f4f6' : 'rgba(255,255,255,0.04)',
                      color: done ? '#fff' : isLight ? '#374151' : '#e5e7eb',
                      ['--tw-ring-color' as any]: accent + '88',
                    }}
                  >
                    {d.slice(8)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
          <button className={`btn-icon ${isLight ? 'text-gray-500 hover:bg-gray-100' : ''}`} onClick={onEdit} title="编辑"><Pencil size={14} /></button>
          <button className={`btn-icon ${isLight ? 'text-gray-500 hover:bg-gray-100' : ''}`} onClick={onDelete} title="删除"><Trash2 size={14} /></button>
        </div>
      </div>
    </li>
  );
}

function FieldInput({ field, value, onChange, isLight, inputCls, accent }: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  isLight: boolean;
  inputCls: string;
  accent: string;
}) {
  const labelCls = `mb-1 block text-xs font-medium ${isLight ? 'text-gray-500' : 'text-slate-300'}`;
  const ringStyle = { ['--tw-ring-color' as any]: accent + '55' };
  if (field.type === 'longtext') {
    return (
      <label className="block">
        <span className={labelCls}>{field.label}{field.required && <span className="text-red-500"> *</span>}</span>
        <textarea
          className={inputCls + ' min-h-[80px] resize-y'}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={ringStyle}
        />
      </label>
    );
  }
  if (field.type === 'select' || field.type === 'priority') {
    return (
      <label className="block">
        <span className={labelCls}>{field.label}</span>
        <select className={inputCls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} style={ringStyle}>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span className={isLight ? 'text-sm text-gray-700' : 'text-sm text-slate-200'}>{field.label}</span>
      </label>
    );
  }
  return (
    <label className="block">
      <span className={labelCls}>{field.label}{field.required && <span className="text-red-500"> *</span>}</span>
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
        className={inputCls}
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
        style={ringStyle}
      />
    </label>
  );
}
