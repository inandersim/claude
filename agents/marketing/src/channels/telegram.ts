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

export const TELEGRAM_API = 'https://api.telegram.org';
const CAPTION_LIMIT = 1024;

export const spec: ChannelSpec = {
  id: 'telegram',
  label: 'Telegram (kanal + gruplar)',
  maxChars: 4096,
  recommendedChars: 700,
  maxHashtags: 4,
  linkPolicy: 'inline',
  formats: ['text', 'single_image', 'carousel', 'poll', 'short'],
  bestTimes: { tr: ['08:00', '12:30', '21:00'], en: ['09:00', '18:00'], ru: ['09:00', '20:00'] },
  tone: 'Kısa, bilgi ve haber tonu; günlük "bugün nereye?" kartları, tehlike uyarıları, hafta sonu rota önerisi. Grup sohbetinde topluluk yöneticisi sesi.',
  rules: [
    'Fotoğraflı mesajda açıklama 1024 karakter; uzun metin için önce metin, sonra görsel.',
    'Düz metin gönder (parse_mode yok) — özel karakter hataları olmaz.',
    'Kanal: günde 1–2 mesaj; şehir grupları (Zirve İstanbul / Ankara / İzmir / Antalya) etkinlik odaklı.',
    'Anketler (poll) katılımı 3–5 kat artırır; haftalık "hafta sonu nereye?" anketi.',
    'Bağlantıya UTM ekle (utm_source=telegram).',
  ],
  canPublish: true,
};

export function format(post: Post): FormattedPost {
  const out = compose(post, spec);
  if (post.media.length > 0 && out.text.length > CAPTION_LIMIT)
    out.warnings.push(
      `fotoğraf açıklaması ${out.text.length} > ${CAPTION_LIMIT}; metin ayrı mesaj olarak gönderilir`,
    );
  return out;
}

interface TgResponse {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
}

/** Telegram Bot API: sendPhoto (URL ya da multipart) / sendMessage. Bot kanalda yönetici olmalı. */
export const publisher: Publisher = {
  async publish(post: Post, formatted: FormattedPost, ctx: PublishContext): Promise<PublishResult> {
    const requests: PlannedRequest[] = [];
    const result: PublishResult = {
      channel: 'telegram',
      postId: post.id,
      ok: false,
      remoteIds: [],
      requests,
    };
    const token = ctx.env.TELEGRAM_BOT_TOKEN?.trim();
    const chat = ctx.env.TELEGRAM_CHANNEL?.trim();
    if (!token || !chat) {
      result.error = 'TELEGRAM_BOT_TOKEN ve TELEGRAM_CHANNEL gerekli';
      return result;
    }
    const base = `${TELEGRAM_API}/bot${token}`;
    try {
      const media = post.media[0];
      const fitsCaption = formatted.text.length <= CAPTION_LIMIT;
      if (media) {
        const method = media.type === 'video' ? 'sendVideo' : 'sendPhoto';
        const field = media.type === 'video' ? 'video' : 'photo';
        const body: Record<string, string> = { chat_id: chat };
        if (fitsCaption) body.caption = formatted.text;
        const files: Record<string, { blob: Blob; name: string }> = {};
        if (media.url) body[field] = media.url;
        else if (media.path && !ctx.dryRun) files[field] = await fileField(media.path);
        else if (media.path) body[field] = `@${media.path}`;
        const planned: PlannedRequest = {
          method: 'POST',
          url: `${base}/${method}`,
          body,
          note: 'medya gönder',
        };
        requests.push(planned);
        const res = await call<TgResponse>(ctx, planned, { form: body, files });
        if (res.ok === false) throw new Error(res.description ?? 'Telegram hatası');
        result.remoteIds.push(String(res.result?.message_id ?? 'dry-run'));
      }
      if (!media || !fitsCaption) {
        const body: Record<string, string> = {
          chat_id: chat,
          text: formatted.text,
          disable_web_page_preview: post.media.length > 0 ? 'true' : 'false',
        };
        const planned: PlannedRequest = {
          method: 'POST',
          url: `${base}/sendMessage`,
          body,
          note: 'metin gönder',
        };
        requests.push(planned);
        const res = await call<TgResponse>(ctx, planned, { json: body });
        if (res.ok === false) throw new Error(res.description ?? 'Telegram hatası');
        result.remoteIds.push(String(res.result?.message_id ?? 'dry-run'));
      }
      result.ok = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    return result;
  },
};

export const channel: Channel = { spec, format, publisher };
