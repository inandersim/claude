import { localeSet } from './shared';

const tr = {
  title: 'Çevrimdışı haritalar',
};

const en: typeof tr = {
  title: 'Offline maps',
};

/** maps modülü çevirileri — tr kaynak, en zorunlu; diğer diller aşağıya eklenir. */
export const mapsI18n = localeSet(tr, en);
