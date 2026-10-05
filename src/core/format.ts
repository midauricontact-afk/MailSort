const MONTH_MS = 30.44 * 24 * 3600 * 1000;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 1;
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: digits })} ${units[i]}`;
}

export function formatCount(n: number, singular: string, plural = `${singular}s`): string {
  return `${n.toLocaleString('fr-FR')} ${n > 1 ? plural : singular}`;
}

export function formatDate(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const days = Math.floor((now - ms) / (24 * 3600 * 1000));
  if (days < 1 && new Date(now).getDate() === d.getDate()) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (days < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  if (days < 300) return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function monthsAgo(months: number, now = Date.now()): number {
  return now - months * MONTH_MS;
}

export function ageInMonths(ms: number, now = Date.now()): number {
  return (now - ms) / MONTH_MS;
}

/** « de Amazon » → « d'Amazon » (élision devant une voyelle). */
export function de(name: string): string {
  return /^[aeiouyhàâéèêëîïôöùûü]/i.test(name) ? `d’${name}` : `de ${name}`;
}
