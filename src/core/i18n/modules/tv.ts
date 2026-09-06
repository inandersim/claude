import { localeSet } from './shared';

const tr = {
  title: 'Zirtan TV',
};

/** Diğer dillerin uyması gereken şekil. */
export type TvI18nShape = typeof tr;

const en: TvI18nShape = {
  title: 'Zirtan TV',
};

/** tv modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const tvI18n = localeSet(tr, en);
