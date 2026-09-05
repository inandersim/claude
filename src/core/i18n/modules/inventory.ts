import { localeSet } from './shared';

const tr = {
  title: 'Rezervasyon',
};

const en: typeof tr = {
  title: 'Reservations',
};

/** inventory modülü çevirileri — tr kaynak, en zorunlu; diğer diller aşağıya eklenir. */
export const inventoryI18n = localeSet(tr, en);
