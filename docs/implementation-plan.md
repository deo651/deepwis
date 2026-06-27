# AtomForge 实现计划

> 笔试挑战：在当前空仓库中，完成一个可运行、可部署、可演示的 Atoms-Demo。

## 1. MVP 定义

一个 AI App Builder 网页应用：

- 用户输入一句自然语言需求 → 系统通过可视化的 Agent 工作流（理解需求 / 拆解功能 / 生成 Schema / 校验 / 启动预览）生成一个真正可交互的小应用，并在右侧预览区直接体验。
- 用户可以继续输入自然语言修改指令（如"增加深色模式"、"加搜索"、"加趋势图"），每次修改生成一个新版本。
- 项目、版本、对话、应用数据均使用 IndexedDB 持久化，刷新不丢。
- 内置 3-5 个模板，30 秒内体验完整闭环。
- 支持版本 Diff、版本恢复、JSON 导出导入。
- DemoProvider 默认可用，无需 Key；可选接入 Azure OpenAI 兼容 LLM（通过 `.env`）。

## 2. 技术选型

- **构建**：Vite + React 18 + TypeScript
- **样式**：Tailwind CSS（深色优先，克制现代）
- **状态**：Zustand（轻量、可选 persist 中间件，但我们直接用 IndexedDB 主导）
- **持久化**：IndexedDB（通过 `idb` 库），对象库：`projects`、`versions`、`messages`、`appData`
- **图标**：lucide-react
- **图表**：recharts（趋势图、统计图）
- **JSON Diff**：`diff` 库（行级文本 diff，演示直观）
- **LLM**（可选）：通过 OpenAI 兼容 base_url（与 `gpt.py` 中 Azure 端点一致），从 `.env` 读取，`vite-env` 类型声明

## 3. 数据模型

### App Schema（统一 Renderer 渲染）

```ts
type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'priority';

interface FieldDef {
  key: string; label: string; type: FieldType;
  options?: string[]; required?: boolean; default?: any;
}

interface EntityDef {
  key: string; label: string; icon?: string;
  fields: FieldDef[];
  // 内置行为
  completable?: boolean; // 是否带"完成"概念（todo/habit）
  streakable?: boolean;  // 连续打卡天数
  amountField?: string;  // 用于汇总（expense）
}

interface StatDef {
  key: string;
  kind: 'count' | 'sum' | 'streak' | 'weeklyTrend' | 'categoryPie';
  label: string;
  entity: string;
  field?: string;
}

interface FeatureDef {
  search?: boolean;
  filter?: { field: string }[];
  dataExport?: boolean;
  darkMode?: boolean;
}

interface AppSchema {
  id: string;
  name: string;
  tagline: string;
  category: 'todo' | 'habit' | 'expense' | 'notes' | 'bookmark' | 'generic';
  theme: { primary: string; mode: 'light' | 'dark' };
  entity: EntityDef;       // MVP 单实体；扩展可改成 entities[]
  stats: StatDef[];
  features: FeatureDef;
}
```

### 持久化对象库

- `projects`：`{ id, name, requirement, currentVersionId, createdAt, updatedAt }`
- `versions`：`{ id, projectId, schema, instruction, parentId, createdAt }`
- `messages`：`{ id, projectId, role, content, kind: 'plan'|'log'|'user'|'assistant', steps?, createdAt }`
- `appData`：`{ projectId+entityKey -> records[] }`（生成应用的运行时数据）

## 4. Agent 工作流

```
理解需求 (250ms)
  → 拆解功能 (350ms)
  → 生成 Schema (600ms)
  → 校验与修复 (200ms)
  → 启动预览 (150ms)
```

每步在 UI 中作为一个 `AgentStep`，状态：`pending → running → done`，可展开看子日志和 token 化输出。

### DemoProvider 规则

`generateApp(requirement)`：
- 关键词分类：`习惯/打卡/habit` → habit；`待办/todo` → todo；`记账/账单/expense` → expense；`笔记/note` → notes；`书签/bookmark` → bookmark；否则 generic。
- 从分类模板派生 schema，并根据需求中的特征词附加 features（搜索、筛选、统计、深色等）。
- 名称从需求中提取或回退到分类默认名。

`modifyApp(schema, instruction)`：
- 指令模式匹配：
  - "深色"/"dark" → toggle theme mode
  - "搜索"/"search" → features.search = true
  - "筛选"/"分类"/"filter"/"category" → features.filter += 关联字段
  - "趋势"/"统计"/"chart"/"图" → stats 中加入 weeklyTrend / categoryPie
  - "优先级"/"priority" → entity.fields 加入 priority
  - "简洁"/"简短" → tagline 简化
  - 通用：在 schema.history 中追加说明
- 返回新 schema（不变性更新）。

### LLMProvider

- 从 `.env`（`VITE_LLM_BASE_URL`、`VITE_LLM_MODEL`、`VITE_LLM_API_KEY`）读取。
- 调用 `chat.completions`（非流式即可，控制简单），system prompt 严格要求返回 JSON Schema。
- 失败或缺配置 → 在 UI 显式提示"未配置/失败，已降级到 DemoProvider"，并自动回退。
- Key 绝不写入仓库或日志，所有调用前过滤敏感字段。

## 5. UI 布局

```
┌──────────────────────────────────────────────────────────┐
│ Topbar  AtomForge · 项目名 · 版本 v3 · 保存中 · 导出/发布 │
├──────────┬───────────────────────┬───────────────────────┤
│ Sidebar  │  Agent Workspace       │  Preview / Code / Diff│
│ 项目列表  │  对话 + 执行轨迹       │  实时渲染子应用       │
│ 模板入口  │  输入框                │  Tab 切换             │
└──────────┴───────────────────────┴───────────────────────┘
```

- 空状态：Onboarding + 模板卡片
- 加载态：Agent 步骤 spinner / skeleton
- 错误态：Toast + Provider 降级横幅

## 6. 亮点能力（按优先级）

1. **版本历史 + Diff + 一键恢复**（必做）
2. **模板市场**（必做，5 个高质量模板）
3. **JSON 导出 / 导入**（轻量补充）
4. **LLMProvider 降级提示**（合规性体现）

## 7. 验证清单（Phase 4）

- [ ] `npm install` 成功
- [ ] `npm run dev` 在本地 5173 启动并能交互
- [ ] `npm run build` 通过
- [ ] 新建项目 → 输入需求 → 看到 Agent 5 步 → 预览可交互
- [ ] 子应用增删改查 + 刷新数据仍在
- [ ] 二次修改 → 新版本生成
- [ ] 切换历史版本 → 预览恢复
- [ ] Diff 视图正确
- [ ] DemoProvider 与 LLM 降级提示
- [ ] 模板一键创建
