import { localeSet } from './shared';

const tr = {
  title: 'Eğlence',
};

const en: typeof tr = {
  title: 'Fun',
};

/** fun modülü çevirileri — tr kaynak, en zorunlu; diğer diller aşağıya eklenir. */
export const funI18n = localeSet(tr, en);
