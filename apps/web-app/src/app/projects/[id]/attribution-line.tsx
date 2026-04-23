import type { AuthorRef } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';


interface Props {
  createdBy: AuthorRef | null;
  updatedBy: AuthorRef | null;
  updatedAt: string;
  dict: Dictionary;
  className?: string;
}


export function AttributionLine({ createdBy, updatedBy, updatedAt, dict, className }: Props) {

  const showEditor = updatedBy && (!createdBy || updatedBy.id !== createdBy.id);
  const updatedDate = new Date(updatedAt);
  const updatedLabel = Number.isNaN(updatedDate.getTime())
    ? ''
    : updatedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });

  return (
    <p className={`text-[11px] text-gray-500 ${className ?? ''}`}>
      {dict.attribution.createdBy(createdBy?.displayName ?? dict.attribution.unknown)}
      {showEditor && (
        <>
          {' · '}
          {dict.attribution.updatedBy(updatedBy!.displayName)}
        </>
      )}
      {updatedLabel && <span className="text-gray-600"> · {updatedLabel}</span>}
    </p>
  );
}
