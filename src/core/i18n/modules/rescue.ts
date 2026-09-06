import { localeSet } from './shared';

const tr = {
  title: 'Ülke kurtarma dizini',
};

/** Diğer dillerin uyması gereken şekil. */
export type RescueI18nShape = typeof tr;

const en: RescueI18nShape = {
  title: 'Country rescue directory',
};

/** rescue modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const rescueI18n = localeSet(tr, en);
