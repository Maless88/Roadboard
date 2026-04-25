import { listActivity } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';


const TARGET_BADGE: Record<string, string> = {
  task: 'bg-indigo-500/10 text-indigo-400',
  phase: 'bg-purple-500/10 text-purple-400',
  decision: 'bg-yellow-500/10 text-yellow-400',
  memory_entry: 'bg-teal-500/10 text-teal-400',
  user: 'bg-emerald-500/10 text-emerald-400',
};


function formatRelative(iso: string): string {

  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60_000);

  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}


interface Props {
  token: string;
  projectId: string;
  dict: Dictionary;
}


export async function ActivityTimeline({ token, projectId, dict }: Props) {

  const page = await listActivity(token, projectId, { take: 100 }).catch(() => null);

  if (!page || page.events.length === 0) {
    return <p className="text-xs text-gray-500">{dict.activity.empty}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{page.total} eventi</p>
      <ol className="space-y-1">
        {page.events.map((ev) => {

          const actorName = ev.actor?.displayName ?? dict.attribution.unknown;
          const verb = dict.activity.events[ev.eventType] ?? ev.eventType;
          const metaTitle = ev.metadata && typeof (ev.metadata as { title?: unknown }).title === 'string'
            ? (ev.metadata as { title: string }).title
            : null;

          return (
            <li
              key={ev.id}
              className="flex items-start gap-3 rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${TARGET_BADGE[ev.targetType] ?? 'bg-gray-700 text-gray-300'}`}
              >
                {ev.targetType}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300">
                  <span className="font-medium text-white">{actorName}</span>
                  {ev.source === 'mcp' && (
                    <span className="ml-1 text-[10px] px-1 py-px rounded bg-indigo-500/10 text-indigo-300">
                      {dict.attribution.viaMcp}
                    </span>
                  )}
                  <span className="text-gray-400"> {verb}</span>
                  {metaTitle && <span className="text-gray-300">: {metaTitle}</span>}
                </p>
                {ev.metadata && typeof (ev.metadata as { from?: unknown }).from === 'string' && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {String((ev.metadata as { from: string }).from)} →{' '}
                    {String((ev.metadata as { to?: string }).to ?? '')}
                  </p>
                )}
              </div>
              <span className="text-[11px] text-gray-600 font-mono shrink-0">{formatRelative(ev.createdAt)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
