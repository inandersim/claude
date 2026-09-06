import { localeSet } from './shared';

const tr = {
  title: 'Çevrimiçi doktor',
};

/** Diğer dillerin uyması gereken şekil. */
export type TelemedI18nShape = typeof tr;

const en: TelemedI18nShape = {
  title: 'Online doctor',
};

/** telemed modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const telemedI18n = localeSet(tr, en);
