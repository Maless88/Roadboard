import { Sidebar } from './sidebar';


interface ActiveProject {
  id: string;
  name: string;
  taskDone: number;
  taskTotal: number;
}

interface UserProject {
  id: string;
  name: string;
  status: string;
}


interface AppShellProps {
  children: React.ReactNode;
  username: string;
  displayName: string;
  activeProject?: ActiveProject;
  userProjects?: UserProject[];
}


export function AppShell({ children, username, displayName, activeProject, userProjects }: AppShellProps) {

  return (
    <div className="flex min-h-screen">
      <Sidebar
        username={username}
        displayName={displayName}
        activeProject={activeProject}
        userProjects={userProjects}
      />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
