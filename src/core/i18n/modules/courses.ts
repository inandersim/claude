import { localeSet } from './shared';

const tr = {
  title: 'Eğitimler',
};

/** Diğer dillerin uyması gereken şekil. */
export type CoursesI18nShape = typeof tr;

const en: CoursesI18nShape = {
  title: 'Courses',
};

/** courses modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const coursesI18n = localeSet(tr, en);
