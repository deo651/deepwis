import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { db } from '@/db/db';

async function reset() {
  // Memory store 用于无 IDB 的环境；通过 list + delete 清理
  const projects = await db.listProjects();
  for (const p of projects) await db.deleteProject(p.id);
  useStore.setState({
    projects: [],
    versions: [],
    messages: [],
    records: [],
    currentProjectId: null,
    previewVersionId: null,
    agentRunning: false,
    liveSteps: [],
    toasts: [],
  });
}

describe('store integration', () => {
  beforeEach(async () => {
    await reset();
  });
  afterEach(async () => {
    await reset();
  });

  it('完整流程：生成 → 修改 → 增删数据 → 持久化', async () => {
    const s = useStore.getState();

    // 1. 通过需求创建项目
    const projectId = await s.createProjectFromRequirement(
      '帮我生成一个任务清单应用，支持搜索和优先级',
    );
    expect(projectId).toBeTruthy();

    let st = useStore.getState();
    expect(st.currentProjectId).toBe(projectId);
    expect(st.versions).toHaveLength(1);
    expect(st.versions[0].schema.entity.fields.some((f) => f.key === 'title')).toBe(true);

    // 2. 增加一条 record
    await st.upsertRecord({ title: '写报告', priority: 'P0' });
    st = useStore.getState();
    expect(st.records).toHaveLength(1);
    expect(st.records[0].title).toBe('写报告');

    // 3. 修改指令 → 新版本
    await st.sendModifyInstruction('加上深色模式和优先级筛选');
    st = useStore.getState();
    expect(st.versions.length).toBe(2);
    expect(st.versions[1].schema.theme.mode).toBe('dark');
    // records 在切换 entity.key 时迁移；这里 entity.key 不变，所以保留
    expect(st.records).toHaveLength(1);

    // 4. 切换回老版本
    const oldId = st.versions[0].id;
    await st.switchPreviewVersion(oldId);
    st = useStore.getState();
    expect(st.previewVersionId).toBe(oldId);

    // 5. 恢复老版本 → 产生新版本
    await st.restoreVersion(oldId);
    st = useStore.getState();
    expect(st.versions.length).toBe(3);
    expect(st.previewVersionId).toBe(st.versions[2].id);

    // 6. 删除 record
    const rid = st.records[0].id;
    await st.deleteRecord(rid);
    st = useStore.getState();
    expect(st.records).toHaveLength(0);

    // 7. 导出 / 导入
    const exported = st.exportData();
    expect(exported).toBeTruthy();
    expect(exported!.versions.length).toBeGreaterThan(0);

    // 8. 删除项目
    await st.deleteProject(projectId);
    st = useStore.getState();
    expect(st.projects.find((p) => p.id === projectId)).toBeUndefined();
  }, 60_000);

  it('从模板创建跳过 Agent 步骤但仍正确建模', async () => {
    const s = useStore.getState();
    const { TEMPLATES } = await import('@/templates/templates');
    const habit = TEMPLATES.find((t) => t.id === 'tmpl_habit')!;
    const id = await s.createProjectFromSchema(habit.title, JSON.parse(JSON.stringify(habit.schema)), habit.requirement);
    expect(id).toBeTruthy();
    const st = useStore.getState();
    expect(st.versions[0].schema.entity.streakable).toBe(true);
  });
});
