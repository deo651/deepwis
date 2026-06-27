/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 深色 surface 系（页面 / 卡片 / 边框）—— 主界面默认基调
        paper: {
          page: '#0a0f1d',         // 整体页面深背景
          subtle: '#10172a',       // 次背景（hover / 列表偶数行）
          card: '#161c33',         // 卡片 / 面板基色
          muted: '#0d1226',        // 弱背景（代码区）
          border: 'rgba(148,163,184,0.10)',   // 标准边框（slate-400 / 10%）
          borderStrong: 'rgba(148,163,184,0.22)',
        },
        // 文字色阶（语义保留：text-ink-900 为主文字色，数值越大越显眼）
        // 反转后在深背景上仍然 "数值越高 = 越突出"
        ink: {
          50: '#020617',
          100: '#0f172a',
          200: '#1e293b',
          300: '#334155',
          400: '#64748b',
          500: '#94a3b8',
          600: '#cbd5e1',
          700: '#dbe2ee',
          800: '#e8edf6',
          900: '#f1f5fb',
          950: '#f8fafc',
        },
        atom: {
          50: '#1e1b4b',           // 在深背景上做"低调高亮"，比浅色 indigo-50 更克制
          100: '#3730a3',
          200: '#4338ca',
          300: '#6366f1',
          400: '#818cf8',
          500: '#a5b4fc',
          600: '#6366f1',          // 主色保持 indigo-500 — 在深背景上有足够辨识度
          700: '#a5b4fc',          // 文字色 hover：浅紫
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(99,102,241,0.45), 0 8px 30px rgba(99,102,241,0.28)',
        card: '0 1px 2px rgba(2,6,23,0.40), 0 1px 3px rgba(2,6,23,0.45)',
        soft: '0 1px 2px rgba(2,6,23,0.35)',
      },
      animation: {
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
