import type { Post } from '../schemas.js';
import { compose, hookWarning } from './format.js';
import { call, fileField } from './http.js';
import { META_GRAPH } from './instagram.js';
import type {
  Channel,
  ChannelSpec,
  FormattedPost,
  PlannedRequest,
  PublishContext,
  PublishResult,
  Publisher,
} from './types.js';

export const spec: ChannelSpec = {
  id: 'facebook',
  label: 'Facebook (Sayfa + gruplar)',
  maxChars: 63_206,
  recommendedChars: 600,
  maxHashtags: 3,
  linkPolicy: 'inline',
  formats: ['single_image', 'carousel', 'text', 'reel', 'live', 'poll'],
  bestTimes: { tr: ['09:00', '13:00', '20:30'], en: ['11:00', '19:00'], ru: ['10:00', '20:00'] },
  tone: 'Daha uzun, hikâye anlatan; gruplarda önce değer (rota bilgisi, güvenlik notu), sonra en fazla bir cümle uygulama.',
  rules: [
    'Gruplarda paylaşım ≠ Sayfa gönderisi: grup kurallarını oku, link atmadan önce 3–5 faydalı yorum yaz.',
    'Hashtag en fazla 2–3; Facebook’ta hashtag erişim getirmez.',
    'Bağlantı metnin sonunda; UTM ekle (utm_source=facebook).',
    'Fotoğraf albümü / karusel: 3–6 görsel, ilk görsel manzara.',
    'Yorumlara ilk 1 saat içinde yanıt ver (erişim sinyali).',
  ],
  canPublish: true,
};

export function format(post: Post): FormattedPost {
  const out = compose(post, spec);
  const hook = hookWarning(post.body, 80);
  if (hook) out.warnings.push(hook);
  return out;
}

interface FbResponse {
  id?: string;
  post_id?: string;
}

/**
 * Facebook Sayfa yayını: fotoğraf → POST /{page-id}/photos (url ya da multipart `source`);
 * yalnız metin/bağlantı → POST /{page-id}/feed; video → POST /{page-id}/videos.
 */
export const publisher: Publisher = {
  async publish(post: Post, formatted: FormattedPost, ctx: PublishContext): Promise<PublishResult> {
    const requests: PlannedRequest[] = [];
    const result: PublishResult = {
      channel: 'facebook',
      postId: post.id,
      ok: false,
      remoteIds: [],
      requests,
    };
    const token = ctx.env.META_ACCESS_TOKEN?.trim();
    const pageId = ctx.env.FB_PAGE_ID?.trim();
    if (!token || !pageId) {
      result.error = 'META_ACCESS_TOKEN ve FB_PAGE_ID gerekli';
      return result;
    }
    try {
      const media = post.media[0];
      if (media && media.type === 'video') {
        const body: Record<string, string> = { description: formatted.text };
        const files: Record<string, { blob: Blob; name: string }> = {};
        if (media.url) body.file_url = media.url;
        else if (media.path && !ctx.dryRun) files.source = await fileField(media.path);
        else if (media.path) body.source = `@${media.path}`;
        const planned: PlannedRequest = {
          method: 'POST',
          url: `${META_GRAPH}/${pageId}/videos`,
          body,
          note: 'sayfa videosu',
        };
        requests.push(planned);
        const res = await call<FbResponse>(ctx, planned, {
          form: { ...body, access_token: token },
          files,
        });
        result.remoteIds.push(res.id ?? 'dry-run');
      } else if (media) {
        const body: Record<string, string> = { message: formatted.text };
        const files: Record<string, { blob: Blob; name: string }> = {};
        if (media.url) body.url = media.url;
        else if (media.path && !ctx.dryRun) files.source = await fileField(media.path);
        else if (media.path) body.source = `@${media.path}`;
        const planned: PlannedRequest = {
          method: 'POST',
          url: `${META_GRAPH}/${pageId}/photos`,
          body,
          note: 'sayfa fotoğrafı',
        };
        requests.push(planned);
        const res = await call<FbResponse>(ctx, planned, {
          form: { ...body, access_token: token },
          files,
        });
        result.remoteIds.push(res.post_id ?? res.id ?? 'dry-run');
      } else {
        const body: Record<string, string> = { message: formatted.text };
        if (formatted.link) body.link = formatted.link;
        const planned: PlannedRequest = {
          method: 'POST',
          url: `${META_GRAPH}/${pageId}/feed`,
          body,
          note: 'sayfa gönderisi',
        };
        requests.push(planned);
        const res = await call<FbResponse>(ctx, planned, {
          form: { ...body, access_token: token },
        });
        result.remoteIds.push(res.id ?? 'dry-run');
      }
      result.ok = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    return result;
  },
};

export const channel: Channel = { spec, format, publisher };
