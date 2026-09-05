import { COMMONS_API } from './config.js';
import { fetchWithRetry } from './http.js';

/**
 * Wikimedia Commons dosya adı → lisanslı görsel bilgisi.
 * @returns {Promise<{url:string; thumbUrl:string; license:string; author:string; attribution:string}|null>}
 */
export async function fetchCommonsImage(
  fileName,
  { fetchImpl = fetchWithRetry, width = 1024 } = {},
) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    titles: `File:${fileName}`,
    iiprop: 'url|extmetadata',
    iiurlwidth: String(width),
    iiextmetadatafilter:
      'LicenseShortName|Artist|Credit|AttributionRequired|Attribution|UsageTerms',
  });
  const res = await fetchImpl(`${COMMONS_API}?${params}`);
  const json = await res.json();
  const page = Object.values(json.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  return parseImageInfo(info);
}

/** imageinfo yanıtını sade yapıya çevirir (test edilebilir). */
export function parseImageInfo(info) {
  const meta = info.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? 'unknown';
  const author = stripHtml(
    meta.Attribution?.value ?? meta.Artist?.value ?? meta.Credit?.value ?? 'Bilinmeyen',
  );
  const attributionRequired = (meta.AttributionRequired?.value ?? 'true') !== 'false';
  return {
    url: info.url,
    thumbUrl: info.thumburl ?? info.url,
    license,
    author,
    attribution: attributionRequired
      ? `${author} — ${license}, Wikimedia Commons`
      : `${license}, Wikimedia Commons`,
  };
}

/** Lisansı ticari kullanıma uygun mu? (NC / ND lisansları reddedilir) */
export function isLicenseUsable(license) {
  const l = license.toLowerCase();
  if (l.includes('nc') || l.includes('nd')) return false;
  return /cc|public domain|pd|gfdl|fal/.test(l);
}

function stripHtml(html) {
  return String(html)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
