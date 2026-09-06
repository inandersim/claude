import { openAsBlob } from 'node:fs';
import { basename } from 'node:path';

import type { PlannedRequest, PublishContext } from './types.js';
import { redact } from './types.js';

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, url: string) {
    super(`HTTP ${status} ← ${redact(url)}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

/** Dosya yolu ya da URL'den multipart alanı üretir. */
export async function fileField(path: string): Promise<{ blob: Blob; name: string }> {
  return { blob: await openAsBlob(path), name: basename(path) };
}

/**
 * JSON ya da multipart POST. `ctx.dryRun` iken çağrı yapılmaz, yalnızca planlanır ve
 * `{}` döner; gerçek çağrıda yanıt JSON'u döner.
 */
export async function call<T = Record<string, unknown>>(
  ctx: PublishContext,
  planned: PlannedRequest,
  options: {
    /** Form alanları (application/x-www-form-urlencoded ya da multipart). */
    form?: Record<string, string>;
    /** Multipart dosya alanları. */
    files?: Record<string, { blob: Blob; name: string }>;
    /** JSON gövde. */
    json?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  ctx.log(
    `${ctx.dryRun ? '[dry-run] ' : ''}${planned.method} ${redact(planned.url)} — ${planned.note}`,
  );
  if (planned.body) {
    for (const [k, v] of Object.entries(planned.body))
      ctx.log(`    ${k}: ${redact(v).replace(/\n+/gu, ' ⏎ ').slice(0, 160)}`);
  }
  if (ctx.dryRun) return {} as T;

  let body: string | FormData | URLSearchParams | undefined;
  const headers: Record<string, string> = { ...options.headers };
  if (options.json) {
    body = JSON.stringify(options.json);
    headers['content-type'] = 'application/json';
  } else if (options.files && Object.keys(options.files).length > 0) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(options.form ?? {})) fd.append(k, v);
    for (const [k, f] of Object.entries(options.files)) fd.append(k, f.blob, f.name);
    body = fd;
  } else if (options.form) {
    body = new URLSearchParams(options.form);
  }

  const res = await ctx.fetchImpl(planned.url, { method: planned.method, headers, body });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text, planned.url);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, `JSON değil: ${text}`, planned.url);
  }
}

/** URLSearchParams → sorgu dizesi; log için token maskelenir. */
export function withQuery(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}
