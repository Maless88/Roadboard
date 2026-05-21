import Link from 'next/link';
import { listAuditEvents } from '@/lib/api';
import type { AuditEvent } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';


const TARGET_BADGE: Record<string, string> = {
  task: 'bg-indigo-500/10 text-indigo-400',
  phase: 'bg-purple-500/10 text-purple-400',
  decision: 'bg-yellow-500/10 text-yellow-400',
  memory_entry: 'bg-teal-500/10 text-teal-400',
  user: 'bg-emerald-500/10 text-emerald-400',
};


const ACTOR_TYPE_VALUES: ReadonlyArray<'user' | 'mcp_token' | 'system'> = ['user', 'mcp_token', 'system'];


const PAGE_SIZE = 50;


function isActorType(value: string | undefined): value is 'user' | 'mcp_token' | 'system' {
  return value !== undefined && (ACTOR_TYPE_VALUES as readonly string[]).includes(value);
}


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


function actorTypeBadgeLabel(actorType: AuditEvent['actorType'], dict: Dictionary): string | null {

  if (actorType === 'mcp_token') return dict.project.filters.actorTypeMcpToken;
  if (actorType === 'system') return dict.project.filters.actorTypeSystem;

  return null;
}


function pageHref(projectId: string, p: number, filters: ActivityTimelineProps['filters']): string {
  const params = new URLSearchParams();
  params.set('tab', 'activity');

  if (filters.eventType) params.set('eventType', filters.eventType);
  if (filters.actorType) params.set('actorType', filters.actorType);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  if (p > 1) params.set('page', String(p));

  return `/projects/${projectId}?${params.toString()}`;
}


interface ActivityTimelineProps {
  token: string;
  projectId: string;
  dict: Dictionary;
  filters: {
    eventType?: string;
    actorType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  };
}


export async function ActivityTimeline({ token, projectId, dict, filters }: ActivityTimelineProps) {

  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const actorType = isActorType(filters.actorType) ? filters.actorType : undefined;

  const data = await listAuditEvents(token, projectId, {
    take: PAGE_SIZE,
    skip,
    eventType: filters.eventType,
    actorType,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  }).catch(() => ({ events: [], total: 0, take: PAGE_SIZE, skip }));

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const resetHref = `/projects/${projectId}?tab=activity`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{dict.project.totalEvents(data.total)}</p>
      </div>

      <form
        method="get"
        action={`/projects/${projectId}`}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg p-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <input type="hidden" name="tab" value="activity" />
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-500">{dict.project.filters.eventType}</span>
          <input
            name="eventType"
            defaultValue={filters.eventType ?? ''}
            placeholder="project.created"
            className="px-2 py-1 rounded text-xs text-white"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-500">{dict.project.filters.actorType}</span>
          <select
            name="actorType"
            defaultValue={filters.actorType ?? ''}
            className="px-2 py-1 rounded text-xs text-white"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <option value="">{dict.project.filters.actorTypeAll}</option>
            <option value="user">{dict.project.filters.actorTypeUser}</option>
            <option value="mcp_token">{dict.project.filters.actorTypeMcpToken}</option>
            <option value="system">{dict.project.filters.actorTypeSystem}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-500">{dict.project.filters.dateFrom}</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom ?? ''}
            className="px-2 py-1 rounded text-xs text-white"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-500">{dict.project.filters.dateTo}</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo ?? ''}
            className="px-2 py-1 rounded text-xs text-white"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
        </label>
        <div className="col-span-2 md:col-span-4 flex items-center gap-2">
          <button
            type="submit"
            className="px-3 py-1.5 rounded text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
          >
            Filtra
          </button>
          <Link
            href={resetHref}
            className="px-3 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-gray-200"
          >
            Reset
          </Link>
        </div>
      </form>

      {data.events.length === 0 ? (
        <p className="text-xs text-gray-500">{dict.project.noEvents}</p>
      ) : (
        <ol className="space-y-1">
          {data.events.map((ev) => {

            const actorName = ev.actor?.displayName ?? dict.attribution.unknown;
            const verb = dict.activity.events[ev.eventType] ?? ev.eventType;
            const metaTitle = ev.metadata && typeof (ev.metadata as { title?: unknown }).title === 'string'
              ? (ev.metadata as { title: string }).title
              : null;
            const actorBadge = actorTypeBadgeLabel(ev.actorType, dict);

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
                    {actorBadge && (
                      <span className="ml-1 text-[10px] px-1 py-px rounded bg-indigo-500/10 text-indigo-300">
                        {actorBadge}
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
                  <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
                    {ev.targetType} : {ev.targetId.slice(0, 10)}…
                  </p>
                </div>
                <span className="text-[11px] text-gray-600 font-mono shrink-0">{formatRelative(ev.createdAt)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <Link
            aria-disabled={page <= 1}
            href={page > 1 ? pageHref(projectId, page - 1, filters) : '#'}
            className={`px-3 py-1.5 rounded ${page <= 1 ? 'text-gray-600 pointer-events-none' : 'text-gray-300 hover:bg-white/5'}`}
          >
            ← Precedente
          </Link>
          <span className="text-gray-500">{page} / {totalPages}</span>
          <Link
            aria-disabled={page >= totalPages}
            href={page < totalPages ? pageHref(projectId, page + 1, filters) : '#'}
            className={`px-3 py-1.5 rounded ${page >= totalPages ? 'text-gray-600 pointer-events-none' : 'text-gray-300 hover:bg-white/5'}`}
          >
            Successivo →
          </Link>
        </div>
      )}
    </div>
  );
}
