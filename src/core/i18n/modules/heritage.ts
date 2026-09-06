import { localeSet } from './shared';

const tr = {
  title: 'Tarihi alanlar',
};

/** Diğer dillerin uyması gereken şekil. */
export type HeritageI18nShape = typeof tr;

const en: HeritageI18nShape = {
  title: 'Heritage sites',
};

/** heritage modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const heritageI18n = localeSet(tr, en);
