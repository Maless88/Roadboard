import { getLocale } from '@/lib/i18n';
import { LocaleProvider } from '@/lib/i18n/locale-context';
import { Sidebar } from './sidebar';
import { UpdateBanner } from './update-banner';


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


export async function AppShell({ children, username, displayName, activeProject, userProjects }: AppShellProps) {

  const locale = await getLocale();

  return (
    <LocaleProvider locale={locale}>
      <div className="flex min-h-screen">
        <Sidebar
          username={username}
          displayName={displayName}
          activeProject={activeProject}
          userProjects={userProjects}
          locale={locale}
        />
        <div className="flex-1 min-w-0">
          {children}
        </div>
        <UpdateBanner />
      </div>
    </LocaleProvider>
  );
}
