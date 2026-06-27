import { create } from 'zustand';
import type { AgentMessage, AgentStep, AppRecord, AppVersion, Project } from '@/types/project';
import type { AppSchema } from '@/types/schema';
import { db } from '@/db/db';
import { nanoId } from '@/utils/id';
import { runGenerate, runModify, checkLLMAvailable } from '@/agent';

export type RightPanelTab = 'preview' | 'code' | 'diff' | 'data';

export interface ToastItem {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'error';
}

interface StoreState {
  // 数据
  projects: Project[];
  versions: AppVersion[]; // 当前项目的版本列表
  messages: AgentMessage[]; // 当前项目的消息列表
  records: AppRecord[]; // 当前项目运行时数据
  currentProjectId: string | null;
  /** 当前预览展示的版本（可临时切换至旧版本） */
  previewVersionId: string | null;

  // UI 状态
  rightPanel: RightPanelTab;
  agentRunning: boolean;
  liveSteps: AgentStep[];
  toasts: ToastItem[];
  preferLLM: boolean;
  llmAvailable: boolean;
  llmModel: string;

  // 初始化与项目
  bootstrap(): Promise<void>;
  selectProject(projectId: string | null): Promise<void>;
  createProjectFromRequirement(requirement: string, projectName?: string): Promise<string>;
  createProjectFromSchema(name: string, schema: AppSchema, requirement: string): Promise<string>;
  deleteProject(projectId: string): Promise<void>;
  renameProject(projectId: string, name: string): Promise<void>;

  // Agent 交互
  sendModifyInstruction(instruction: string): Promise<void>;

  // 版本
  switchPreviewVersion(versionId: string): Promise<void>;
  restoreVersion(versionId: string): Promise<void>;

  // 应用数据
  upsertRecord(record: Partial<AppRecord>): Promise<void>;
  deleteRecord(recordId: string): Promise<void>;
  toggleRecordDone(recordId: string): Promise<void>;
  toggleHabitDay(recordId: string, dateISO: string): Promise<void>;
  exportData(): { project: Project; versions: AppVersion[]; records: AppRecord[] } | null;
  importData(payload: unknown): Promise<void>;

  // Provider
  setPreferLLM(v: boolean): void;

  // UI
  setRightPanel(tab: RightPanelTab): void;
  toast(text: string, kind?: ToastItem['kind']): void;
  dismissToast(id: string): void;
}

function currentSchema(state: StoreState): AppSchema | null {
  const vid = state.previewVersionId;
  if (!vid) return null;
  const v = state.versions.find((x) => x.id === vid);
  return v ? v.schema : null;
}

export const useStore = create<StoreState>((set, get) => ({
  projects: [],
  versions: [],
  messages: [],
  records: [],
  currentProjectId: null,
  previewVersionId: null,

  rightPanel: 'preview',
  agentRunning: false,
  liveSteps: [],
  toasts: [],
  preferLLM: false,
  llmAvailable: false,
  llmModel: '',

  async bootstrap() {
    const projects = await db.listProjects();
    const meta = (await db.getMeta<{ preferLLM?: boolean; lastProjectId?: string }>('settings')) ?? {};
    const llm = await checkLLMAvailable();
    set({
      projects,
      llmAvailable: llm.available,
      llmModel: llm.model ?? '',
      preferLLM: meta.preferLLM ?? llm.available,
    });
    if (meta.lastProjectId && projects.find((p) => p.id === meta.lastProjectId)) {
      await get().selectProject(meta.lastProjectId);
    }
  },

  async selectProject(projectId) {
    if (!projectId) {
      set({ currentProjectId: null, versions: [], messages: [], records: [], previewVersionId: null });
      await db.setMeta('settings', { ...(await db.getMeta('settings')) ?? {}, lastProjectId: null });
      return;
    }
    const project = await db.getProject(projectId);
    if (!project) return;
    const versions = await db.listVersions(projectId);
    const messages = await db.listMessages(projectId);
    const current = versions.find((v) => v.id === project.currentVersionId) ?? versions[versions.length - 1];
    const records = current ? await db.getAppRecords(projectId, current.schema.entity.key) : [];
    set({
      currentProjectId: projectId,
      versions,
      messages,
      records,
      previewVersionId: current?.id ?? null,
      rightPanel: 'preview',
    });
    await db.setMeta('settings', { ...((await db.getMeta<Record<string, unknown>>('settings')) ?? {}), lastProjectId: projectId });
  },

  async createProjectFromRequirement(requirement, projectName) {
    const projectId = nanoId('proj');
    const now = Date.now();

    // 用户消息先入库
    const userMsg: AgentMessage = {
      id: nanoId('msg'),
      projectId,
      role: 'user',
      kind: 'user',
      content: requirement,
      createdAt: now,
    };
    await db.putMessage(userMsg);

    set({ agentRunning: true, liveSteps: [] });

    const ctx = {
      onStepUpdate: (step: AgentStep) => {
        const list = get().liveSteps;
        const idx = list.findIndex((s) => s.key === step.key);
        const next = idx >= 0 ? [...list.slice(0, idx), step, ...list.slice(idx + 1)] : [...list, step];
        set({ liveSteps: next });
      },
    };

    let result: Awaited<ReturnType<typeof runGenerate>>;
    try {
      result = await runGenerate(requirement, ctx, get().preferLLM);
    } catch (e) {
      set({ agentRunning: false });
      const errMsg: AgentMessage = {
        id: nanoId('msg'),
        projectId,
        role: 'agent',
        kind: 'error',
        content: '生成失败：' + (e as Error).message,
        createdAt: Date.now(),
      };
      await db.putMessage(errMsg);
      get().toast('生成失败：' + (e as Error).message, 'error');
      throw e;
    }

    const { output, providerId, fallbackReason } = result;
    const versionId = nanoId('ver');
    const version: AppVersion = {
      id: versionId,
      projectId,
      schema: output.schema,
      instruction: requirement,
      parentId: null,
      createdAt: Date.now(),
      changeSummary: '首版生成',
    };
    await db.putVersion(version);

    const project: Project = {
      id: projectId,
      name: projectName?.trim() || output.schema.name,
      requirement,
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: Date.now(),
      emoji: output.schema.emoji,
    };
    await db.putProject(project);

    const planMsg: AgentMessage = {
      id: nanoId('msg'),
      projectId,
      role: 'agent',
      kind: 'plan',
      content: output.notes,
      steps: get().liveSteps,
      versionId,
      createdAt: Date.now(),
      provider: providerId,
      fallbackReason,
    };
    await db.putMessage(planMsg);

    // 初始化 records 为空
    await db.setAppRecords(projectId, output.schema.entity.key, []);

    const projects = await db.listProjects();
    set({ projects, agentRunning: false, liveSteps: [] });
    await get().selectProject(projectId);

    if (fallbackReason) {
      get().toast(`已自动回退到 DemoProvider：${fallbackReason}`, 'info');
    } else {
      get().toast(`应用已生成（${providerId === 'llm' ? 'LLM' : 'Demo'}）`, 'success');
    }
    return projectId;
  },

  async createProjectFromSchema(name, schema, requirement) {
    const projectId = nanoId('proj');
    const now = Date.now();
    const versionId = nanoId('ver');
    const version: AppVersion = {
      id: versionId,
      projectId,
      schema,
      instruction: requirement,
      parentId: null,
      createdAt: now,
      changeSummary: '模板初始化',
    };
    await db.putVersion(version);
    const project: Project = {
      id: projectId,
      name,
      requirement,
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
      emoji: schema.emoji,
    };
    await db.putProject(project);
    const userMsg: AgentMessage = {
      id: nanoId('msg'),
      projectId,
      role: 'user',
      kind: 'user',
      content: requirement,
      createdAt: now,
    };
    await db.putMessage(userMsg);
    const planMsg: AgentMessage = {
      id: nanoId('msg'),
      projectId,
      role: 'agent',
      kind: 'plan',
      content: '从模板生成完成。',
      versionId,
      createdAt: now + 10,
      provider: 'demo',
      steps: [
        { key: 'template', label: '模板加载', status: 'done', logs: ['命中模板：' + schema.name], durationMs: 60 },
        { key: 'launch', label: '启动预览', status: 'done', logs: ['挂载 Renderer'], durationMs: 40 },
      ],
    };
    await db.putMessage(planMsg);
    await db.setAppRecords(projectId, schema.entity.key, []);
    const projects = await db.listProjects();
    set({ projects });
    await get().selectProject(projectId);
    get().toast(`已从模板创建「${name}」`, 'success');
    return projectId;
  },

  async deleteProject(projectId) {
    await db.deleteProject(projectId);
    const projects = await db.listProjects();
    set({ projects });
    if (get().currentProjectId === projectId) {
      await get().selectProject(projects[0]?.id ?? null);
    }
    get().toast('已删除项目', 'info');
  },

  async renameProject(projectId, name) {
    const p = await db.getProject(projectId);
    if (!p) return;
    p.name = name;
    p.updatedAt = Date.now();
    await db.putProject(p);
    const projects = await db.listProjects();
    set({ projects });
  },

  async sendModifyInstruction(instruction) {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const schema = currentSchema(get());
    if (!schema) return;

    const project = await db.getProject(projectId);
    if (!project) return;

    const userMsg: AgentMessage = {
      id: nanoId('msg'),
      projectId,
      role: 'user',
      kind: 'user',
      content: instruction,
      createdAt: Date.now(),
    };
    await db.putMessage(userMsg);
    const existingMessages = await db.listMessages(projectId);
    set({ messages: existingMessages, agentRunning: true, liveSteps: [] });

    const ctx = {
      onStepUpdate: (step: AgentStep) => {
        const list = get().liveSteps;
        const idx = list.findIndex((s) => s.key === step.key);
        const next = idx >= 0 ? [...list.slice(0, idx), step, ...list.slice(idx + 1)] : [...list, step];
        set({ liveSteps: next });
      },
    };

    let result: Awaited<ReturnType<typeof runModify>>;
    try {
      result = await runModify({ schema, notes: '' }, instruction, ctx, get().preferLLM);
    } catch (e) {
      set({ agentRunning: false });
      const errMsg: AgentMessage = {
        id: nanoId('msg'),
        projectId,
        role: 'agent',
        kind: 'error',
        content: '修改失败：' + (e as Error).message,
        createdAt: Date.now(),
      };
      await db.putMessage(errMsg);
      set({ messages: await db.listMessages(projectId) });
      get().toast('修改失败：' + (e as Error).message, 'error');
      return;
    }

    const { output, providerId, fallbackReason } = result;
    const newVersionId = nanoId('ver');
    const newVersion: AppVersion = {
      id: newVersionId,
      projectId,
      schema: output.schema,
      instruction,
      parentId: project.currentVersionId,
      createdAt: Date.now(),
      changeSummary: output.notes || '已应用修改',
    };
    await db.putVersion(newVersion);
    project.currentVersionId = newVersionId;
    project.updatedAt = Date.now();
    await db.putProject(project);

    const planMsg: AgentMessage = {
      id: nanoId('msg'),
      projectId,
      role: 'agent',
      kind: 'plan',
      content: output.notes || '已生成新版本',
      steps: get().liveSteps,
      versionId: newVersionId,
      provider: providerId,
      fallbackReason,
      createdAt: Date.now(),
    };
    await db.putMessage(planMsg);

    // 若 entity.key 变化，迁移数据为该 entity 的空记录；保留原 records
    const oldRecords = await db.getAppRecords(projectId, schema.entity.key);
    if (output.schema.entity.key !== schema.entity.key) {
      await db.setAppRecords(projectId, output.schema.entity.key, oldRecords);
    }

    const versions = await db.listVersions(projectId);
    const messages = await db.listMessages(projectId);
    const records = await db.getAppRecords(projectId, output.schema.entity.key);
    const projects = await db.listProjects();
    set({
      versions,
      messages,
      records,
      previewVersionId: newVersionId,
      projects,
      agentRunning: false,
      liveSteps: [],
    });

    if (fallbackReason) {
      get().toast(`已自动回退到 DemoProvider：${fallbackReason}`, 'info');
    } else {
      get().toast('新版本已生成', 'success');
    }
  },

  async switchPreviewVersion(versionId) {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const version = get().versions.find((v) => v.id === versionId);
    if (!version) return;
    const records = await db.getAppRecords(projectId, version.schema.entity.key);
    set({ previewVersionId: versionId, records });
  },

  async restoreVersion(versionId) {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const project = await db.getProject(projectId);
    const target = get().versions.find((v) => v.id === versionId);
    if (!project || !target) return;
    // 创建一个新版本作为恢复点，保留可追溯性
    const restoredId = nanoId('ver');
    const restoredVersion: AppVersion = {
      id: restoredId,
      projectId,
      schema: JSON.parse(JSON.stringify(target.schema)),
      instruction: `恢复版本 (${versionId.slice(-6)})`,
      parentId: project.currentVersionId,
      createdAt: Date.now(),
      changeSummary: `恢复至 ${new Date(target.createdAt).toLocaleString()} 的版本`,
    };
    await db.putVersion(restoredVersion);
    project.currentVersionId = restoredId;
    project.updatedAt = Date.now();
    await db.putProject(project);
    const planMsg: AgentMessage = {
      id: nanoId('msg'),
      projectId,
      role: 'agent',
      kind: 'plan',
      content: restoredVersion.changeSummary,
      versionId: restoredId,
      createdAt: Date.now(),
      provider: 'demo',
      steps: [
        { key: 'restore', label: '版本恢复', status: 'done', logs: ['复制旧 schema → 新版本'], durationMs: 60 },
      ],
    };
    await db.putMessage(planMsg);

    const versions = await db.listVersions(projectId);
    const messages = await db.listMessages(projectId);
    const records = await db.getAppRecords(projectId, restoredVersion.schema.entity.key);
    const projects = await db.listProjects();
    set({
      versions,
      messages,
      records,
      previewVersionId: restoredId,
      projects,
    });
    get().toast('已恢复到该版本', 'success');
  },

  async upsertRecord(record) {
    const projectId = get().currentProjectId;
    const schema = currentSchema(get());
    if (!projectId || !schema) return;
    const now = Date.now();
    const records = get().records.slice();
    if (record.id) {
      const idx = records.findIndex((r) => r.id === record.id);
      if (idx >= 0) {
        records[idx] = { ...records[idx], ...record, updatedAt: now } as AppRecord;
      }
    } else {
      const newRec: AppRecord = {
        id: nanoId('rec'),
        createdAt: now,
        updatedAt: now,
        ...record,
      };
      if (schema.entity.completable) {
        if (schema.entity.streakable) newRec.completedDates = [];
        else newRec.done = false;
      }
      records.unshift(newRec);
    }
    await db.setAppRecords(projectId, schema.entity.key, records);
    set({ records });
  },

  async deleteRecord(recordId) {
    const projectId = get().currentProjectId;
    const schema = currentSchema(get());
    if (!projectId || !schema) return;
    const records = get().records.filter((r) => r.id !== recordId);
    await db.setAppRecords(projectId, schema.entity.key, records);
    set({ records });
  },

  async toggleRecordDone(recordId) {
    const projectId = get().currentProjectId;
    const schema = currentSchema(get());
    if (!projectId || !schema) return;
    const records = get().records.map((r) =>
      r.id === recordId ? { ...r, done: !r.done, updatedAt: Date.now() } : r,
    );
    await db.setAppRecords(projectId, schema.entity.key, records);
    set({ records });
  },

  async toggleHabitDay(recordId, dateISO) {
    const projectId = get().currentProjectId;
    const schema = currentSchema(get());
    if (!projectId || !schema) return;
    const records = get().records.map((r) => {
      if (r.id !== recordId) return r;
      const dates = new Set(r.completedDates ?? []);
      if (dates.has(dateISO)) dates.delete(dateISO);
      else dates.add(dateISO);
      return { ...r, completedDates: Array.from(dates).sort(), updatedAt: Date.now() };
    });
    await db.setAppRecords(projectId, schema.entity.key, records);
    set({ records });
  },

  exportData() {
    const projectId = get().currentProjectId;
    if (!projectId) return null;
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return null;
    return {
      project,
      versions: get().versions,
      records: get().records,
    };
  },

  async importData(payload) {
    try {
      const p = payload as { project: Project; versions: AppVersion[]; records: AppRecord[] };
      if (!p || !p.project || !p.versions || !p.records) throw new Error('数据结构不合法');
      // 重新分配 id，避免与现有冲突
      const newProjectId = nanoId('proj');
      const idMap = new Map<string, string>();
      const newVersions = p.versions.map((v) => {
        const nid = nanoId('ver');
        idMap.set(v.id, nid);
        return { ...v, id: nid, projectId: newProjectId, parentId: v.parentId ? idMap.get(v.parentId) ?? null : null };
      });
      const project: Project = {
        ...p.project,
        id: newProjectId,
        name: p.project.name + ' (导入)',
        currentVersionId: idMap.get(p.project.currentVersionId) ?? newVersions[newVersions.length - 1].id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      for (const v of newVersions) await db.putVersion(v);
      await db.putProject(project);
      const entityKey = newVersions[newVersions.length - 1].schema.entity.key;
      await db.setAppRecords(newProjectId, entityKey, p.records);
      const projects = await db.listProjects();
      set({ projects });
      await get().selectProject(newProjectId);
      get().toast('导入成功', 'success');
    } catch (e) {
      get().toast('导入失败：' + (e as Error).message, 'error');
    }
  },

  setPreferLLM(v) {
    set({ preferLLM: v });
    void db.getMeta<Record<string, unknown>>('settings').then((m) => {
      void db.setMeta('settings', { ...(m ?? {}), preferLLM: v });
    });
  },

  setRightPanel(tab) {
    set({ rightPanel: tab });
  },
  toast(text, kind = 'info') {
    const id = nanoId('toast');
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 4500);
  },
  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
