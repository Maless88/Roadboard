export function formatBuildLabel(iso: string | null | undefined): string {

  if (!iso || iso === 'unknown') {
    return 'dev';
  }

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) {
    return 'dev';
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = pad(d.getFullYear() % 100);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());

  return `${yy}.${mm}.${dd}.${hh}${mi}`;
}
