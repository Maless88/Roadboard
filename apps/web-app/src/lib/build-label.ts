export function formatBuildLabel(
  iso: string | null | undefined,
  shaFallback?: string | null,
): string {

  if (iso && iso !== 'unknown') {

    const d = new Date(iso);

    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const yy = pad(d.getFullYear() % 100);
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      return `${yy}.${mm}.${dd}`;
    }
  }

  if (shaFallback) return shaFallback.slice(0, 7);

  return 'dev';
}
