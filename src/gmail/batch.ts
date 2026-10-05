/** Requêtes groupées (batch) de l'API Gmail : jusqu'à 100 appels dans une seule requête HTTP. */

export interface BatchItem {
  method: 'GET' | 'POST' | 'DELETE';
  /** Chemin relatif, ex. /gmail/v1/users/me/messages/abc?format=metadata */
  path: string;
  body?: unknown;
}

export interface BatchResult {
  index: number;
  status: number;
  body: unknown;
}

export function buildBatchBody(items: BatchItem[], boundary: string): string {
  const parts = items.map((item, i) => {
    const lines = [
      `--${boundary}`,
      'Content-Type: application/http',
      `Content-ID: <item${i}>`,
      '',
      `${item.method} ${item.path} HTTP/1.1`,
    ];
    if (item.body !== undefined) {
      const json = JSON.stringify(item.body);
      lines.push('Content-Type: application/json; charset=UTF-8', '', json);
    } else {
      lines.push('');
    }
    return lines.join('\r\n');
  });
  return `${parts.join('\r\n')}\r\n--${boundary}--\r\n`;
}

export function boundaryFromContentType(contentType: string | null): string | null {
  const m = (contentType ?? '').match(/boundary=("?)([^";]+)\1/i);
  return m ? m[2] : null;
}

/** Découpe la réponse multipart/mixed et rend le statut + le JSON de chaque sous-requête. */
export function parseBatchResponse(text: string, boundary: string): BatchResult[] {
  const results: BatchResult[] = [];
  const chunks = text.split(`--${boundary}`);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed || trimmed === '--') continue;
    const idMatch = trimmed.match(/Content-ID:\s*<?response-item(\d+)>?/i);
    const statusMatch = trimmed.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})/);
    if (!idMatch || !statusMatch) continue;
    const afterStatus = trimmed.slice(trimmed.indexOf(statusMatch[0]));
    const bodyStart = afterStatus.search(/\r?\n\r?\n/);
    const rawBody = bodyStart === -1 ? '' : afterStatus.slice(bodyStart).trim();
    let body: unknown = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }
    results.push({ index: Number(idMatch[1]), status: Number(statusMatch[1]), body });
  }
  return results.sort((a, b) => a.index - b.index);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
