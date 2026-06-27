import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { StatKind } from '@/types/schema';

interface Props {
  kind: StatKind;
  data: Array<{ name: string; value: number }>;
  color: string;
  isLight: boolean;
}

function shade(color: string, idx: number): string {
  const palette = [color, '#06b6d4', '#a855f7', '#f59e0b', '#22c55e', '#ec4899', '#3b82f6', '#10b981'];
  return palette[idx % palette.length];
}

export function StatChart({ kind, data, color, isLight }: Props) {
  if (kind === 'categoryPie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={18} outerRadius={32} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={shade(color, i)} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: isLight ? '#fff' : '#0c0e12',
              border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              fontSize: 12,
              color: isLight ? '#111827' : '#fff',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: isLight ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: isLight ? '#fff' : '#0c0e12',
            border: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 8,
            fontSize: 12,
            color: isLight ? '#111827' : '#fff',
          }}
          cursor={{ fill: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
