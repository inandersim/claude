import { localeSet } from './shared';

const tr = {
  title: 'Gruplar',
};

/** Diğer dillerin uyması gereken şekil. */
export type GroupsI18nShape = typeof tr;

const en: GroupsI18nShape = {
  title: 'Groups',
};

/** groups modülü çevirileri — tr kaynak, en zorunlu; diğer diller sonra bağlanır. */
export const groupsI18n = localeSet(tr, en);
