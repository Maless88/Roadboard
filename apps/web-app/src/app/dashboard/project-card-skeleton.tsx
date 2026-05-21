export function ProjectCardSkeleton() {

  return (
    <div
      className="rounded-2xl p-5 animate-pulse"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-white/10 shrink-0" />
          <div className="h-3.5 w-32 rounded-md bg-white/10" />
        </div>
        <div className="h-3 w-14 rounded-md bg-white/10 shrink-0" />
      </div>

      {/* Description */}
      <div className="h-2.5 w-3/4 rounded-md bg-white/[0.07] mb-4" />

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between mb-1.5">
          <div className="h-2 w-16 rounded-md bg-white/[0.07]" />
          <div className="h-2 w-10 rounded-md bg-white/[0.07]" />
        </div>
        <div className="h-1 rounded-full bg-white/[0.07]" />
      </div>

      {/* Task pills */}
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-12 rounded-md bg-white/[0.07]" />
        <div className="h-2.5 w-10 rounded-md bg-white/[0.07]" />
      </div>
    </div>
  );
}


interface ProjectGridSkeletonProps {
  count?: number;
}


export function ProjectGridSkeleton({ count = 6 }: ProjectGridSkeletonProps) {

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </div>
  );
}
