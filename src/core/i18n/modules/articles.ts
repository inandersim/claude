import { localeSet } from './shared';

const tr = {
  title: 'Yazarlar & Blog',
};

/** Diğer dillerin uyması gereken şekil. */
export type ArticlesI18nShape = typeof tr;

const en: ArticlesI18nShape = {
  title: 'Writers & Blog',
};

/** articles modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const articlesI18n = localeSet(tr, en);
