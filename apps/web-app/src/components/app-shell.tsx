import { Sidebar } from './sidebar';


interface ActiveProject {
  id: string;
  name: string;
  taskDone: number;
  taskTotal: number;
}


interface AppShellProps {
  children: React.ReactNode;
  username: string;
  displayName: string;
  activeProject?: ActiveProject;
}


export function AppShell({ children, username, displayName, activeProject }: AppShellProps) {

  return (
    <div className="flex min-h-screen">
      <Sidebar
        username={username}
        displayName={displayName}
        activeProject={activeProject}
      />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
