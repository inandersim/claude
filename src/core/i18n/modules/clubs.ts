import { localeSet } from './shared';

const tr = {
  title: 'Üniversite kulüpleri',
};

const en: typeof tr = {
  title: 'University clubs',
};

/** clubs modülü çevirileri — tr kaynak, en zorunlu; diğer diller aşağıya eklenir. */
export const clubsI18n = localeSet(tr, en);
