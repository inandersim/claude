import type { Post } from '../schemas.js';
import { compose, truncate } from './format.js';
import type { Channel, ChannelSpec, FormattedPost } from './types.js';

export const spec: ChannelSpec = {
  id: 'reddit',
  label: 'Reddit',
  maxChars: 40_000,
  recommendedChars: 2500,
  maxHashtags: 0,
  linkPolicy: 'inline',
  formats: ['text', 'single_image', 'thread'],
  bestTimes: { tr: ['15:00', '21:00'], en: ['14:00', '16:00'], ru: ['16:00'] },
  tone: 'Reklam kokan her şey banlanır. Gerçek deneyim, rakamlar, fotoğraf, dürüst dezavantajlar. Uygulamayı yalnızca sorulursa ya da "bunu biz yaptık, geri bildirim istiyoruz" şeffaflığıyla an.',
  rules: [
    'Hashtag yok. Başlık ≤ 300 karakter, spesifik ("Kaçkar Dağları 3 gün: Ayder–Kavrun–Yukarı Kavrun, rota + maliyet").',
    'r/hiking: kendi ürününü tanıtma yasak; trip report ver. r/CampingandHiking: self-promo %10 kuralı. r/Turkey ve r/TurkeyTravel: seyahat sorularına cevap ver. r/climbing, r/scuba: soru–cevap.',
    'Kendi subreddit’in (r/zirtanapp) + "I built an outdoor safety app for Türkiye, AMA" tarzı r/SideProject / r/androidapps gönderileri.',
    'Yorumlarda savunma yapma; eleştiriye "haklısın, ekledik" ile dön.',
    'Bağlantıyı gövdenin sonuna, UTM ile; başlıkta asla.',
  ],
  canPublish: false,
};

export function format(post: Post): FormattedPost {
  const out = compose(post, spec, { hashtags: false });
  out.title = truncate(post.title, 300);
  if (/indir|download|скачай/iu.test(post.title))
    out.warnings.push('başlıkta CTA/indirme çağrısı Reddit’te ban riski');
  return out;
}

export const channel: Channel = { spec, format };
