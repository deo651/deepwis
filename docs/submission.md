# 笔试提交说明 — AtomForge

## 基本信息

- **Demo 名称**：AtomForge
- **在线访问链接**：⟦待部署后填入，建议 Vercel / Netlify / Cloudflare Pages⟧
- **GitHub 源码链接**：⟦待 push 后填入，请将仓库设为 Public⟧
- **本地启动**：
  ```bash
  npm install && npm run dev
  # http://localhost:5173
  ```

## 一、实现思路

AtomForge 把 Atoms 风格"一句话生成可交互应用"的核心体验解构成三层：

1. **Agent 层** — 抽象出 `AgentProvider` 接口，提供本地推理的 `DemoProvider`（默认可用）和 OpenAI/Azure 兼容的 `LLMProvider`（可选）。两者都按 **5 步可视化工作流**输出，前端用回调驱动 UI 步进。
2. **Schema 层** — 设计一套通用的 `AppSchema`（实体 + 字段 + 统计 + 特征 + 主题），任何小应用都用同一份描述。
3. **Renderer 层** — 一个通用 React 渲染器读取 Schema，渲染出真正可增删改查、可搜索筛选、可统计可视化的子应用。

修改流程相同：自然语言 → Schema patch → 新版本 → Renderer 热更新。版本之间用 `diff` 库比对，提供 Diff 视图与一键恢复。

## 二、关键取舍

| 取舍点 | 选择 | 原因 |
| --- | --- | --- |
| 单实体 vs 多实体 Schema | **单实体** | MVP 已能覆盖习惯 / 任务 / 记账 / 笔记 / 书签 5 类需求；多实体会让 Renderer 复杂度翻倍，性价比低 |
| LLM 还是规则 | **DemoProvider 优先 + 可选 LLM** | 保证 demo 无 Key 也可玩；LLM 接入作为加分项，并提供降级 |
| 持久化方式 | **IndexedDB** | 无需后端、容量足够、结构化查询友好；jsdom 自动降级 memory 便于测试 |
| 版本恢复策略 | **追加新版本（不覆盖历史）** | 真正的 time travel：旧版本始终可回看 |
| API Key 来源 | **`.env` 客户端注入** | demo 简单可控；生产场景建议改服务端代理（已在 README 提示） |
| 状态管理 | **Zustand** | 单一 store，所有 actions 直写 async，避免 redux 的样板 |

## 三、当前完成程度

**完整闭环（必做项）**

- [x] 项目创建 / 列表 / 切换 / 删除 / 重命名
- [x] Agent 5 步执行轨迹（状态 / 耗时 / 日志）
- [x] 通用 Schema → 可交互应用渲染
- [x] 至少 2 类应用（已覆盖 5 类：习惯、任务、记账、笔记、书签）
- [x] 自然语言二次修改 → 新版本
- [x] IndexedDB 持久化（projects / versions / messages / appData / meta）
- [x] 刷新页面不丢失
- [x] 模板市场（5 个）
- [x] 版本切换 + Diff + 一键恢复
- [x] JSON 导入 / 导出
- [x] LLMProvider 降级提示
- [x] 错误态 / 加载态 / 空状态 / Toast

**延展亮点（已实现）**

- [x] **版本时间旅行**：可切换历史、可恢复（恢复生成新版本可追溯）
- [x] **模板市场**：5 个高质量预设
- [x] **JSON 导入导出**：项目级别完整备份
- [x] **Diff 视图**：行级 schema 对比，红绿高亮

**工程质量**

- [x] TypeScript 严格模式，全部代码类型化
- [x] ESLint 0 warning（`--max-warnings 0`）
- [x] 11 个测试（unit + integration）全绿
- [x] `npm run build` 无错误，gzip 后 ~183 KB
- [x] 模块化拆分（types / db / store / agent / renderer / components）
- [x] `.env` 不提交、`.gitignore` 完备

## 四、如果继续投入时间，扩展计划

> 按 ROI 排序：

1. **服务端代理 LLM Key**（半天）— 用 Cloudflare Workers / Vercel Functions 承载 Key，前端只调代理。让线上 Demo 可以安全启用 LLM。
2. **流式输出**（半天）— 把 Agent "日志"换成真实 LLM token 流，体验更接近 Atoms。
3. **多实体 Schema**（1 天）— Renderer 加 Tabs，支持一个应用包含多个 entity（如"项目 → 任务"）。
4. **代码视图编辑器**（半天）— Monaco + JSON Schema 校验，允许直接改 schema 触发预览刷新。
5. **公开分享页**（1 天，需后端）— 输入 JSON → 短链 readonly 预览。
6. **失败自动修复**（半天）— LLM 返回非合法 JSON 时，自动追加修复指令二次调用。
7. **AGV 测试**（1 天）— 加 Playwright 端到端测试覆盖核心 5 个用户路径。
8. **可访问性 / 国际化**（1 天）— ARIA、键盘导航、英文文案切换。

## 五、自检结果

```text
npm run typecheck   ✓
npm run lint        ✓
npm test            ✓ 11 passed
npm run build       ✓ dist/index.html  0.63 kB
                      dist/assets/index.css  23.81 kB │ gzip 5.02 kB
                      dist/assets/index.js   629.57 kB │ gzip 183.13 kB
```

人工检查（详细 6 个场景见 `docs/demo-script.md`）：

1. 新建项目 → 输入需求 → 看到 Agent 5 步 → 预览可交互 ✓
2. 子应用增删改查 + 刷新数据仍在 ✓
3. 二次修改 → 新版本生成 ✓
4. 切换历史版本 → 预览恢复 ✓
5. Diff 视图正确 ✓
6. DemoProvider 默认运行；填 .env 后可切换 LLM；LLM 失败自动回退 ✓
