import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { AgentMessage, AppRecord, AppVersion, Project } from '@/types/project';

const DB_NAME = 'atomforge';
const DB_VERSION = 1;

interface AppDataKey {
  /** projectId + ':' + entityKey */
  composite: string;
  records: AppRecord[];
}

interface AtomForgeDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { updatedAt: number };
  };
  versions: {
    key: string;
    value: AppVersion;
    indexes: { projectId: string };
  };
  messages: {
    key: string;
    value: AgentMessage;
    indexes: { projectId: string };
  };
  appData: {
    key: string; // projectId:entityKey
    value: AppDataKey;
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<AtomForgeDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AtomForgeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AtomForgeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const s = db.createObjectStore('projects', { keyPath: 'id' });
          s.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('versions')) {
          const s = db.createObjectStore('versions', { keyPath: 'id' });
          s.createIndex('projectId', 'projectId');
        }
        if (!db.objectStoreNames.contains('messages')) {
          const s = db.createObjectStore('messages', { keyPath: 'id' });
          s.createIndex('projectId', 'projectId');
        }
        if (!db.objectStoreNames.contains('appData')) {
          db.createObjectStore('appData', { keyPath: 'composite' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// 一些环境（如 SSR 或测试运行时）可能没有 IndexedDB；提供 in-memory fallback
const memoryStore = {
  projects: new Map<string, Project>(),
  versions: new Map<string, AppVersion>(),
  messages: new Map<string, AgentMessage>(),
  appData: new Map<string, AppDataKey>(),
  meta: new Map<string, { key: string; value: unknown }>(),
};

function hasIDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

export const db = {
  // ---------- projects ----------
  async listProjects(): Promise<Project[]> {
    if (!hasIDB()) {
      return Array.from(memoryStore.projects.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }
    const idb = await getDB();
    const list = await idb.getAll('projects');
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async getProject(id: string): Promise<Project | undefined> {
    if (!hasIDB()) return memoryStore.projects.get(id);
    const idb = await getDB();
    return idb.get('projects', id);
  },
  async putProject(p: Project): Promise<void> {
    if (!hasIDB()) {
      memoryStore.projects.set(p.id, p);
      return;
    }
    const idb = await getDB();
    await idb.put('projects', p);
  },
  async deleteProject(id: string): Promise<void> {
    if (!hasIDB()) {
      memoryStore.projects.delete(id);
      for (const [k, v] of memoryStore.versions) if (v.projectId === id) memoryStore.versions.delete(k);
      for (const [k, v] of memoryStore.messages) if (v.projectId === id) memoryStore.messages.delete(k);
      for (const [k] of memoryStore.appData) if (k.startsWith(id + ':')) memoryStore.appData.delete(k);
      return;
    }
    const idb = await getDB();
    const tx = idb.transaction(['projects', 'versions', 'messages', 'appData'], 'readwrite');
    await tx.objectStore('projects').delete(id);
    const versionsByProject = await tx.objectStore('versions').index('projectId').getAllKeys(id);
    for (const k of versionsByProject) await tx.objectStore('versions').delete(k);
    const messagesByProject = await tx.objectStore('messages').index('projectId').getAllKeys(id);
    for (const k of messagesByProject) await tx.objectStore('messages').delete(k);
    const dataKeys = await tx.objectStore('appData').getAllKeys();
    for (const k of dataKeys as string[]) {
      if (k.startsWith(id + ':')) await tx.objectStore('appData').delete(k);
    }
    await tx.done;
  },

  // ---------- versions ----------
  async listVersions(projectId: string): Promise<AppVersion[]> {
    if (!hasIDB()) {
      return Array.from(memoryStore.versions.values())
        .filter((v) => v.projectId === projectId)
        .sort((a, b) => a.createdAt - b.createdAt);
    }
    const idb = await getDB();
    const list = await idb.getAllFromIndex('versions', 'projectId', projectId);
    return list.sort((a, b) => a.createdAt - b.createdAt);
  },
  async getVersion(id: string): Promise<AppVersion | undefined> {
    if (!hasIDB()) return memoryStore.versions.get(id);
    const idb = await getDB();
    return idb.get('versions', id);
  },
  async putVersion(v: AppVersion): Promise<void> {
    if (!hasIDB()) {
      memoryStore.versions.set(v.id, v);
      return;
    }
    const idb = await getDB();
    await idb.put('versions', v);
  },

  // ---------- messages ----------
  async listMessages(projectId: string): Promise<AgentMessage[]> {
    if (!hasIDB()) {
      return Array.from(memoryStore.messages.values())
        .filter((v) => v.projectId === projectId)
        .sort((a, b) => a.createdAt - b.createdAt);
    }
    const idb = await getDB();
    const list = await idb.getAllFromIndex('messages', 'projectId', projectId);
    return list.sort((a, b) => a.createdAt - b.createdAt);
  },
  async putMessage(m: AgentMessage): Promise<void> {
    if (!hasIDB()) {
      memoryStore.messages.set(m.id, m);
      return;
    }
    const idb = await getDB();
    await idb.put('messages', m);
  },

  // ---------- appData ----------
  async getAppRecords(projectId: string, entityKey: string): Promise<AppRecord[]> {
    const composite = `${projectId}:${entityKey}`;
    if (!hasIDB()) return memoryStore.appData.get(composite)?.records ?? [];
    const idb = await getDB();
    const v = await idb.get('appData', composite);
    return v?.records ?? [];
  },
  async setAppRecords(projectId: string, entityKey: string, records: AppRecord[]): Promise<void> {
    const composite = `${projectId}:${entityKey}`;
    if (!hasIDB()) {
      memoryStore.appData.set(composite, { composite, records });
      return;
    }
    const idb = await getDB();
    await idb.put('appData', { composite, records });
  },

  // ---------- meta ----------
  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    if (!hasIDB()) return memoryStore.meta.get(key)?.value as T | undefined;
    const idb = await getDB();
    const v = await idb.get('meta', key);
    return v?.value as T | undefined;
  },
  async setMeta<T = unknown>(key: string, value: T): Promise<void> {
    if (!hasIDB()) {
      memoryStore.meta.set(key, { key, value });
      return;
    }
    const idb = await getDB();
    await idb.put('meta', { key, value });
  },
};
