import { localeSet } from './shared';

const tr = {
  title: 'Çocuk',
};

/** Diğer dillerin uyması gereken şekil. */
export type KidsI18nShape = typeof tr;

const en: KidsI18nShape = {
  title: 'Kids',
};

/** kids modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const kidsI18n = localeSet(tr, en);
