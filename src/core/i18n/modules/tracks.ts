import { localeSet } from './shared';

const tr = {
  title: 'Topluluk rotaları',
};

/** Diğer dillerin uyması gereken şekil. */
export type TracksI18nShape = typeof tr;

const en: TracksI18nShape = {
  title: 'Community trails',
};

/** tracks modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const tracksI18n = localeSet(tr, en);
