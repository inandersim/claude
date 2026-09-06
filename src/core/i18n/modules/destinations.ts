import { localeSet } from './shared';

const tr = {
  title: 'Destinasyonlar',
};

/** Diğer dillerin uyması gereken şekil. */
export type DestinationsI18nShape = typeof tr;

const en: DestinationsI18nShape = {
  title: 'Destinations',
};

/** destinations modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const destinationsI18n = localeSet(tr, en);
