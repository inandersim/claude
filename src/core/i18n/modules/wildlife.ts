import { localeSet } from './shared';

const tr = {
  title: 'Canlı tanıma & güvenlik',
};

/** Diğer dillerin uyması gereken şekil. */
export type WildlifeI18nShape = typeof tr;

const en: WildlifeI18nShape = {
  title: 'Wildlife ID & safety',
};

/** wildlife modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const wildlifeI18n = localeSet(tr, en);
