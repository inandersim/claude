import type { Post } from '../schemas.js';
import { compose } from './format.js';
import { call, fileField } from './http.js';
import type {
  Channel,
  ChannelSpec,
  FormattedPost,
  PlannedRequest,
  PublishContext,
  PublishResult,
  Publisher,
} from './types.js';

export const VK_API = 'https://api.vk.com/method';
export const VK_VERSION = '5.199';

export const spec: ChannelSpec = {
  id: 'vk',
  label: 'VK (ВКонтакте)',
  maxChars: 16_000,
  recommendedChars: 1200,
  maxHashtags: 8,
  linkPolicy: 'inline',
  formats: ['single_image', 'carousel', 'text', 'short', 'long_video', 'poll', 'live'],
  bestTimes: {
    tr: ['10:00', '19:00'],
    en: ['10:00', '19:00'],
    ru: ['08:00', '12:00', '19:00', '21:30'],
  },
  tone: 'Rusça, bilgi yoğun ve pratik: mesafe, sezon, ulaşım, fiyat. Topluluk (сообщество) tarzı; uzun metin sorun değil.',
  rules: [
    'Rusça yaz; Türk yer adlarını Rusça topluluk yazımıyla ver (Ликийская тропа, Каппадокия, Качкар).',
    'Hedef: Kafkasya/Kırgızistan yürüyüşçüleri, Türkiye’ye tatile gelen Rusça konuşanlar, Antalya/Alanya yerleşik topluluğu.',
    'Hashtag 5–8; VK’da hashtag arama çalışır (#ликийскаятропа gibi).',
    'Bağlantı metinde tıklanır; UTM ekle (utm_source=vk).',
    'İlgili topluluklara (походы, треккинг Турция) "предложить новость" ile öner — spam yapma.',
    'VK Clips (kısa video) için 9:16, altyazı Rusça.',
  ],
  canPublish: true,
};

export function format(post: Post): FormattedPost {
  const out = compose(post, spec);
  if (post.lang !== 'ru') out.warnings.push('VK için Rusça içerik önerilir');
  return out;
}

interface VkResponse<T> {
  response?: T;
  error?: { error_code: number; error_msg: string };
}

async function vk<T>(
  ctx: PublishContext,
  requests: PlannedRequest[],
  method: string,
  params: Record<string, string>,
  token: string,
  note: string,
): Promise<T | undefined> {
  const planned: PlannedRequest = {
    method: 'POST',
    url: `${VK_API}/${method}`,
    body: params,
    note,
  };
  requests.push(planned);
  const res = await call<VkResponse<T>>(ctx, planned, {
    form: { ...params, access_token: token, v: VK_VERSION },
  });
  if (res.error)
    throw new Error(`VK ${method} hata ${res.error.error_code}: ${res.error.error_msg}`);
  return res.response;
}

/**
 * VK topluluk duvarı:
 *  fotoğraf: photos.getWallUploadServer → upload_url'e multipart `photo` → photos.saveWallPhoto → wall.post (attachments)
 *  metin: wall.post (from_group=1). Sınır: saniyede 3 istek, günde 50 gönderi.
 */
export const publisher: Publisher = {
  async publish(post: Post, formatted: FormattedPost, ctx: PublishContext): Promise<PublishResult> {
    const requests: PlannedRequest[] = [];
    const result: PublishResult = {
      channel: 'vk',
      postId: post.id,
      ok: false,
      remoteIds: [],
      requests,
    };
    const token = ctx.env.VK_ACCESS_TOKEN?.trim();
    const groupId = ctx.env.VK_GROUP_ID?.trim().replace(/^-/u, '');
    if (!token || !groupId) {
      result.error = 'VK_ACCESS_TOKEN ve VK_GROUP_ID gerekli';
      return result;
    }
    try {
      const attachments: string[] = [];
      for (const media of post.media.filter((m) => m.type === 'image').slice(0, 10)) {
        const server = await vk<{ upload_url: string }>(
          ctx,
          requests,
          'photos.getWallUploadServer',
          { group_id: groupId },
          token,
          'yükleme sunucusu',
        );
        const uploadUrl = server?.upload_url ?? 'https://upload.vk.example/dry-run';
        const uploadPlanned: PlannedRequest = {
          method: 'POST',
          url: uploadUrl,
          body: { photo: `@${media.path || media.url}` },
          note: 'fotoğraf yükle (multipart)',
        };
        requests.push(uploadPlanned);
        if (ctx.dryRun) ctx.log(`[dry-run] POST ${uploadPlanned.url} — ${uploadPlanned.note}`);
        let uploaded: { server: number; photo: string; hash: string } = {
          server: 0,
          photo: '',
          hash: '',
        };
        if (!ctx.dryRun) {
          const file = media.path
            ? await fileField(media.path)
            : await downloadAsFile(ctx, media.url);
          uploaded = await call(ctx, uploadPlanned, { files: { photo: file } });
        }
        const saved = await vk<{ owner_id: number; id: number }[]>(
          ctx,
          requests,
          'photos.saveWallPhoto',
          {
            group_id: groupId,
            server: String(uploaded.server),
            photo: uploaded.photo,
            hash: uploaded.hash,
          },
          token,
          'fotoğrafı kaydet',
        );
        const photo = saved?.[0];
        attachments.push(photo ? `photo${photo.owner_id}_${photo.id}` : 'photo-dry-run');
      }
      if (formatted.link && post.media.length === 0) attachments.push(formatted.link);
      const params: Record<string, string> = {
        owner_id: `-${groupId}`,
        from_group: '1',
        message: formatted.text,
      };
      if (attachments.length > 0) params.attachments = attachments.join(',');
      const posted = await vk<{ post_id: number }>(
        ctx,
        requests,
        'wall.post',
        params,
        token,
        'duvara gönder',
      );
      result.remoteIds.push(posted ? `wall-${groupId}_${posted.post_id}` : 'dry-run');
      result.ok = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    return result;
  },
};

async function downloadAsFile(
  ctx: PublishContext,
  url: string,
): Promise<{ blob: Blob; name: string }> {
  const res = await ctx.fetchImpl(url);
  if (!res.ok) throw new Error(`medya indirilemedi: ${url}`);
  return { blob: await res.blob(), name: url.split('/').pop() || 'photo.jpg' };
}

export const channel: Channel = { spec, format, publisher };
