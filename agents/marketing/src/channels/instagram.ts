import type { Post } from '../schemas.js';
import { compose, hookWarning } from './format.js';
import { call, withQuery } from './http.js';
import type {
  Channel,
  ChannelSpec,
  FormattedPost,
  PlannedRequest,
  PublishContext,
  PublishResult,
  Publisher,
} from './types.js';

export const META_GRAPH = 'https://graph.facebook.com/v21.0';

export const spec: ChannelSpec = {
  id: 'instagram',
  label: 'Instagram',
  maxChars: 2200,
  recommendedChars: 900,
  maxHashtags: 12,
  linkPolicy: 'bio',
  formats: ['reel', 'carousel', 'single_image', 'story', 'collab', 'live'],
  bestTimes: {
    tr: ['08:30', '12:30', '19:30', '21:00'],
    en: ['10:00', '13:00', '20:00'],
    ru: ['09:00', '19:00'],
  },
  tone: 'Görsel önce; ilk satır kanca (125 karakterden önce), kısa paragraflar, satır boşluğu bol. Reel senaryosu 7–30 sn, ilk 1,5 sn kanca.',
  rules: [
    'Hashtag 8–12: 3 çekirdek (#zirveapp …) + 4 niş + 3 yerel; hepsi açıklamanın sonunda.',
    'Bağlantı tıklanmaz → "bağlantı bio’da" de; Story’de link sticker kullan.',
    'Reels: dikey 9:16, altyazı zorunlu (sessiz izleme), ilk karede metin.',
    'Karusel: 5–8 kare, son kare CTA; kaydet/paylaş çağrısı.',
    'İş birliği gönderisi (Collab) kulüp/rehber hesabıyla → iki kitleye birden düşer.',
    'UGC yeniden paylaşımda @atıf ve izin notu.',
  ],
  canPublish: true,
};

export function format(post: Post): FormattedPost {
  const linkNote =
    post.lang === 'ru'
      ? 'Ссылка в профиле.'
      : post.lang === 'en'
        ? 'Link in bio.'
        : 'Bağlantı bio’da.';
  const out = compose(post, spec, { linkNote });
  const hook = hookWarning(post.body, 125);
  if (hook) out.warnings.push(hook);
  if (post.format === 'reel' && post.scenes.length === 0)
    out.warnings.push('Reel için sahne senaryosu yok');
  return out;
}

interface MetaId {
  id?: string;
  status_code?: string;
  error?: { message?: string };
}

/**
 * Instagram Content Publishing API:
 *  1) POST /{ig-user-id}/media (konteyner)  2) [video ise durumu bekle]  3) POST /{ig-user-id}/media_publish
 * Medya herkese açık bir URL olmalı (Graph API yerel dosya kabul etmez).
 */
export const publisher: Publisher = {
  async publish(post: Post, formatted: FormattedPost, ctx: PublishContext): Promise<PublishResult> {
    const requests: PlannedRequest[] = [];
    const result: PublishResult = {
      channel: 'instagram',
      postId: post.id,
      ok: false,
      remoteIds: [],
      requests,
    };
    const token = ctx.env.META_ACCESS_TOKEN?.trim();
    const igUser = ctx.env.IG_USER_ID?.trim();
    if (!token || !igUser) {
      result.error = 'META_ACCESS_TOKEN ve IG_USER_ID gerekli';
      return result;
    }
    const media = post.media.filter((m) => m.url.trim());
    if (media.length === 0) {
      result.error = 'Instagram için herkese açık medya URL’si gerekli (media[].url)';
      return result;
    }

    const post_ = async (
      path: string,
      body: Record<string, string>,
      note: string,
    ): Promise<MetaId> => {
      const planned: PlannedRequest = { method: 'POST', url: `${META_GRAPH}/${path}`, body, note };
      requests.push(planned);
      return call<MetaId>(ctx, planned, { form: { ...body, access_token: token } });
    };

    try {
      let creationId: string;
      const first = media[0];
      if (!first) throw new Error('medya yok');
      if (post.format === 'carousel' && media.length > 1) {
        const children: string[] = [];
        for (const m of media.slice(0, 10)) {
          const child = await post_(
            `${igUser}/media`,
            m.type === 'video'
              ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: 'true' }
              : { image_url: m.url, is_carousel_item: 'true' },
            'karusel öğesi konteyneri',
          );
          children.push(child.id ?? 'dry-run-child');
        }
        const container = await post_(
          `${igUser}/media`,
          { media_type: 'CAROUSEL', children: children.join(','), caption: formatted.text },
          'karusel konteyneri',
        );
        creationId = container.id ?? 'dry-run-container';
      } else if (post.format === 'reel' || first.type === 'video') {
        const container = await post_(
          `${igUser}/media`,
          {
            media_type: 'REELS',
            video_url: first.url,
            caption: formatted.text,
            share_to_feed: 'true',
          },
          'Reels konteyneri',
        );
        creationId = container.id ?? 'dry-run-container';
        await waitForContainer(ctx, creationId, token, requests);
      } else if (post.format === 'story') {
        const container = await post_(
          `${igUser}/media`,
          { media_type: 'STORIES', image_url: first.url },
          'Story konteyneri',
        );
        creationId = container.id ?? 'dry-run-container';
      } else {
        const container = await post_(
          `${igUser}/media`,
          { image_url: first.url, caption: formatted.text },
          'görsel konteyneri',
        );
        creationId = container.id ?? 'dry-run-container';
      }
      const published = await post_(
        `${igUser}/media_publish`,
        { creation_id: creationId },
        'yayınla',
      );
      result.remoteIds.push(published.id ?? creationId);
      result.ok = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    return result;
  },
};

/** Video konteynerleri işlenene kadar (FINISHED) durum sorgusu; dry-run'da atlanır. */
async function waitForContainer(
  ctx: PublishContext,
  creationId: string,
  token: string,
  requests: PlannedRequest[],
): Promise<void> {
  const planned: PlannedRequest = {
    method: 'GET',
    url: withQuery(`${META_GRAPH}/${creationId}`, { fields: 'status_code' }),
    note: 'video işleme durumu (FINISHED bekle)',
  };
  requests.push(planned);
  if (ctx.dryRun) return;
  for (let i = 0; i < 20; i += 1) {
    const res = await ctx.fetchImpl(withQuery(planned.url, { access_token: token }));
    const data = (await res.json()) as MetaId;
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Instagram video işleme hatası');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Instagram video işleme zaman aşımı');
}

export const channel: Channel = { spec, format, publisher };
