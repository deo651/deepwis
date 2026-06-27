import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { AgentWorkspace } from '@/components/AgentWorkspace';
import { PreviewPanel } from '@/components/PreviewPanel';
import { Topbar } from '@/components/Topbar';
import { Toasts } from '@/components/Toasts';
import { useStore } from '@/store/store';
import type { Template } from '@/templates/templates';

export default function App() {
  const bootstrap = useStore((s) => s.bootstrap);
  const createProjectFromRequirement = useStore((s) => s.createProjectFromRequirement);
  const createProjectFromSchema = useStore((s) => s.createProjectFromSchema);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  async function handleTemplate(t: Template) {
    await createProjectFromSchema(t.title, JSON.parse(JSON.stringify(t.schema)), t.requirement);
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden text-ink-900">
      <Topbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar onPickTemplate={handleTemplate} />
        <AgentWorkspace onStartNewProject={createProjectFromRequirement} />
        <PreviewPanel />
      </div>
      <Toasts />
    </div>
  );
}
