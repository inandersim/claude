import { localeSet } from './shared';

const tr = {
  title: 'Topluluk',
};

/** Diğer dillerin uyması gereken şekil. */
export type SocialI18nShape = typeof tr;

const en: SocialI18nShape = {
  title: 'Community',
};

/** social modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const socialI18n = localeSet(tr, en);
