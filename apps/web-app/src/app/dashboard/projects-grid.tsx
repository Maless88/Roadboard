import { getDashboardSnapshot } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { SwipeableProjectCard } from './swipeable-project-card';
import type { Project } from '@/lib/api';


interface Props {
  token: string;
  projects: Project[];
}


export async function ProjectsGrid({ token, projects }: Props) {

  const dict = await getDict();

  if (projects.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{dict.projects.noProjects}</p>
      </div>
    );
  }

  const snapshots = await Promise.all(
    projects.map((p) =>
      getDashboardSnapshot(token, p.id).catch((err: unknown) => {
        const status = (err as { status?: number }).status;

        if (status === 403) return { error: 'forbidden' as const };

        return { error: 'unknown' as const };
      }),
    ),
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {projects.map((project, i) => (
        <SwipeableProjectCard
          key={project.id}
          project={project}
          snap={snapshots[i]}
        />
      ))}
    </div>
  );
}
