import { localeSet } from './shared';

const tr = {
  title: 'Ülke rehberi',
};

/** Diğer dillerin uyması gereken şekil. */
export type CountriesI18nShape = typeof tr;

const en: CountriesI18nShape = {
  title: 'Country guide',
};

/** countries modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const countriesI18n = localeSet(tr, en);
