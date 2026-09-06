import type { Article, ArticleComment, WriterProfile } from '@/domain';

export const seedWriters: WriterProfile[] = [];
export const seedWriterFollows: { followerId: string; writerUserId: string }[] = [];
export const seedArticles: Article[] = [];
export const seedArticleComments: ArticleComment[] = [];
export const seedArticleLikes: { userId: string; articleId: string }[] = [];
export const seedArticleSaves: { userId: string; articleId: string }[] = [];
