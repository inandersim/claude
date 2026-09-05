import { localeSet } from './shared';

const tr = {
  title: 'Tırmanış',
};

const en: typeof tr = {
  title: 'Climbing',
};

/** climbing modülü çevirileri — tr kaynak, en zorunlu; diğer diller aşağıya eklenir. */
export const climbingI18n = localeSet(tr, en);
