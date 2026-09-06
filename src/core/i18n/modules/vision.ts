import { localeSet } from './shared';

const tr = {
  title: 'Kamera ile sor',
};

/** Diğer dillerin uyması gereken şekil. */
export type VisionI18nShape = typeof tr;

const en: VisionI18nShape = {
  title: 'Ask with camera',
};

/** vision modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const visionI18n = localeSet(tr, en);
