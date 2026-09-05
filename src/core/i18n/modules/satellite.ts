import { localeSet } from './shared';

const tr = {
  title: 'Uydu bağlantısı',
};

const en: typeof tr = {
  title: 'Satellite link',
};

/** satellite modülü çevirileri — tr kaynak, en zorunlu; diğer diller aşağıya eklenir. */
export const satelliteI18n = localeSet(tr, en);
