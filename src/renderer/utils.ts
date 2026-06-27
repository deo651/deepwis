import type { AppRecord } from '@/types/project';
import type { AppSchema, StatDef } from '@/types/schema';
import { lastNDays } from '@/utils/id';

export function isToday(iso: string): boolean {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return iso === `${y}-${m}-${d}`;
}

export function isThisMonth(iso: string): boolean {
  if (!iso) return false;
  const t = new Date();
  const [y, m] = iso.split('-');
  return Number(y) === t.getFullYear() && Number(m) === t.getMonth() + 1;
}

export function computeStat(
  stat: StatDef,
  records: AppRecord[],
  schema: AppSchema,
): { value: string; subValue?: string; chartData?: Array<{ name: string; value: number }> } {
  switch (stat.kind) {
    case 'count':
      return { value: String(records.length) };
    case 'completedCount': {
      const done = records.filter((r) => r.done === true).length;
      return { value: String(done), subValue: `共 ${records.length} 条` };
    }
    case 'sum': {
      const field = stat.field;
      if (!field) return { value: '-' };
      let total = 0;
      for (const r of records) {
        const ds = (r as Record<string, unknown>)['date'];
        if (typeof ds === 'string' && !isThisMonth(ds)) continue;
        const v = Number((r as Record<string, unknown>)[field]);
        if (!Number.isNaN(v)) total += v;
      }
      return { value: `${stat.unit ?? ''}${total.toFixed(2)}` };
    }
    case 'streak': {
      if (!schema.entity.streakable) return { value: '0', subValue: stat.unit };
      let maxStreak = 0;
      for (const r of records) {
        const dates = (r.completedDates ?? []).slice().sort();
        if (dates.length === 0) continue;
        let cur = 1;
        let best = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
          const cd = new Date(dates[i]);
          const diff = Math.round((cd.getTime() - prev.getTime()) / 86400000);
          if (diff === 1) {
            cur++;
            best = Math.max(best, cur);
          } else {
            cur = 1;
          }
        }
        maxStreak = Math.max(maxStreak, best);
      }
      return { value: String(maxStreak), subValue: stat.unit ?? '天' };
    }
    case 'weeklyTrend': {
      const days = lastNDays(7);
      const data = days.map((d) => {
        let count = 0;
        for (const r of records) {
          if (schema.entity.streakable) {
            if ((r.completedDates ?? []).includes(d)) count += 1;
          } else {
            const ds = (r as Record<string, unknown>)['date'] as string | undefined;
            if (ds === d) count += 1;
          }
        }
        return { name: d.slice(5), value: count };
      });
      return { value: String(data.reduce((s, x) => s + x.value, 0)), chartData: data };
    }
    case 'categoryPie': {
      const field = stat.field;
      if (!field) return { value: '-' };
      const map = new Map<string, number>();
      for (const r of records) {
        const key = String((r as Record<string, unknown>)[field] ?? '其他');
        const amount = Number((r as Record<string, unknown>)[schema.entity.amountField ?? 'amount']);
        const add = Number.isNaN(amount) ? 1 : amount;
        map.set(key, (map.get(key) ?? 0) + add);
      }
      const data = Array.from(map.entries()).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
      return { value: String(records.length), chartData: data };
    }
    default:
      return { value: '-' };
  }
}

export function filterAndSearchRecords(
  records: AppRecord[],
  schema: AppSchema,
  search: string,
  filters: Record<string, string>,
): AppRecord[] {
  let list = records;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((r) => {
      return schema.entity.fields.some((f) => {
        const v = (r as Record<string, unknown>)[f.key];
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      });
    });
  }
  for (const [key, val] of Object.entries(filters)) {
    if (!val) continue;
    list = list.filter((r) => {
      const v = (r as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v.includes(val);
      if (typeof v === 'string') return v.split(',').map((x) => x.trim()).includes(val) || v === val;
      return String(v) === val;
    });
  }
  return list;
}

export function uniqueValues(records: AppRecord[], key: string): string[] {
  const set = new Set<string>();
  for (const r of records) {
    const v = (r as Record<string, unknown>)[key];
    if (typeof v === 'string') {
      v.split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => set.add(x));
    } else if (Array.isArray(v)) {
      v.forEach((x) => set.add(String(x)));
    }
  }
  return Array.from(set);
}
