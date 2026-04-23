interface EmptyStateProps {
  title: string;
  hint?: string;
  badge?: string;
}


export function EmptyState({ title, hint, badge }: EmptyStateProps) {

  return (
    <div
      className="rounded-xl px-6 py-10 flex flex-col items-center text-center gap-2"
      style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
    >
      {badge && (
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}
        >
          {badge}
        </span>
      )}
      <p className="text-sm text-gray-300">{title}</p>
      {hint && <p className="text-xs text-gray-500 max-w-md">{hint}</p>}
    </div>
  );
}
