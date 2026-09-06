import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });

const validInput = {
  title: 'Aladağlar Demirkazık kuzey yüzü',
  subtitle: 'Kışın ilk denemem',
  coverUri: null,
  category: 'trip_report' as const,
  body: 'Bu yazı ' + 'kar ve buz üzerinde geçen uzun bir günün notlarıdır. '.repeat(8),
  tags: ['#Aladağlar', 'kış'],
  destinationId: null,
  countryCode: 'TR',
  adventureTypes: ['climbing' as const],
  publish: true,
};

describe('Articles', () => {
  it('liste: öne çıkanlar önce, taslaklar yalnızca sahibine görünür', async () => {
    const p = make();
    const all = await p.articles.list(CURRENT_USER_ID, {});
    expect(all).toHaveLength(13);
    expect(all[0]?.status).toBe('featured');
    expect(all[1]?.status).toBe('featured');
    expect(all.some((a) => a.status === 'draft')).toBe(false);
    const kerem = await p.articles.list('u_kerem', {});
    expect(kerem.some((a) => a.id === 'art_geyik_7a')).toBe(true);
    const nepal = await p.articles.list(CURRENT_USER_ID, { countryCode: 'NP' });
    expect(nepal.every((a) => a.countryCode === 'NP')).toBe(true);
    expect(all.find((a) => a.id === 'art_ebc_12')?.likedByMe).toBe(true);
    expect(all.find((a) => a.id === 'art_ebc_12')?.savedByMe).toBe(true);
  });

  it('getBySlug görüntülenmeyi artırır ve yazar/rozet bilgisi taşır', async () => {
    const p = make();
    const first = await p.articles.getBySlug(CURRENT_USER_ID, 'kas-ta-ilk-10-dalis-noktasi');
    expect(first?.author.id).toBe('u_zeynep');
    expect(first?.writer?.penName).toContain('Zeynep');
    const second = await p.articles.getBySlug(CURRENT_USER_ID, 'kas-ta-ilk-10-dalis-noktasi');
    expect(second?.viewsCount).toBe((first?.viewsCount ?? 0) + 1);
    expect(await p.articles.getBySlug(CURRENT_USER_ID, 'yok-boyle-bir-yazi')).toBeNull();
  });

  it('yazar değilken create hata verir; applyWriter sonrası create çalışır ve slug tekilleşir', async () => {
    const p = make();
    expect(await p.articles.myWriterProfile(CURRENT_USER_ID)).toBeNull();
    await expect(p.articles.create(CURRENT_USER_ID, validInput)).rejects.toThrow(
      /yazar başvurusu/i,
    );

    const profile = await p.articles.applyWriter(CURRENT_USER_ID, {
      penName: 'Deniz — Aladağlar',
      bio: 'Aladağlar ve Bolkarlar üzerine kış tırmanış notları yazıyorum.',
      languages: ['TR', 'en'],
      topics: ['trip_report'],
      website: null,
    });
    expect(profile.approvedAt).not.toBeNull();
    expect(profile.languages).toEqual(['tr', 'en']);

    const created = await p.articles.create(CURRENT_USER_ID, validInput);
    expect(created.slug).toBe('aladaglar-demirkazik-kuzey-yuzu');
    expect(created.tags).toEqual(['aladağlar', 'kış']);
    expect(created.status).toBe('published');
    expect(created.readMinutes).toBeGreaterThanOrEqual(1);
    const again = await p.articles.create(CURRENT_USER_ID, { ...validInput, publish: false });
    expect(again.slug).toBe('aladaglar-demirkazik-kuzey-yuzu-2');
    expect(again.status).toBe('draft');

    const me = await p.articles.myWriterProfile(CURRENT_USER_ID);
    expect(me?.articleCount).toBe(1);
    const mine = await p.articles.mine(CURRENT_USER_ID);
    expect(mine).toHaveLength(2);

    // Doğrulama
    await expect(
      p.articles.create(CURRENT_USER_ID, { ...validInput, title: 'Kısa' }),
    ).rejects.toThrow();
    // Yetki
    await expect(
      p.articles.update(CURRENT_USER_ID, 'art_ebc_12', { title: 'Başka' }),
    ).rejects.toThrow();
    const updated = await p.articles.update(CURRENT_USER_ID, again.id, { publish: true });
    expect(updated.status).toBe('published');
    expect(updated.publishedAt).not.toBeNull();
  });

  it('toggleLike sayaç + bildirim, toggleSave ve saved listesi', async () => {
    const p = make();
    const before = await p.articles.getBySlug(
      CURRENT_USER_ID,
      'kackar-da-kis-gecisi-ekipman-listesi-ve-hatalarim',
    );
    expect(before?.likedByMe).toBe(false);
    const liked = await p.articles.toggleLike(CURRENT_USER_ID, 'art_kackar_kis');
    expect(liked.likedByMe).toBe(true);
    expect(liked.likesCount).toBe((before?.likesCount ?? 0) + 1);
    const unliked = await p.articles.toggleLike(CURRENT_USER_ID, 'art_kackar_kis');
    expect(unliked.likedByMe).toBe(false);
    expect(unliked.likesCount).toBe(before?.likesCount);

    const notifications = await p.notifications.list('u_can');
    expect(notifications.some((n) => n.type === 'like' && n.targetId === 'art_kackar_kis')).toBe(
      true,
    );

    const saved = await p.articles.toggleSave(CURRENT_USER_ID, 'art_kackar_kis');
    expect(saved.savedByMe).toBe(true);
    const list = await p.articles.saved(CURRENT_USER_ID);
    expect(list.map((a) => a.id)).toContain('art_kackar_kis');
    expect(list).toHaveLength(4);
  });

  it('yorum ekler, sayaç artar ve yazara comment bildirimi gider', async () => {
    const p = make();
    const before = await p.articles.comments('art_ebc_12');
    expect(before).toHaveLength(5);
    const comment = await p.articles.addComment(CURRENT_USER_ID, 'art_ebc_12', '  Harika yazı!  ');
    expect(comment.content).toBe('Harika yazı!');
    expect(comment.author.id).toBe(CURRENT_USER_ID);
    const after = await p.articles.comments('art_ebc_12');
    expect(after).toHaveLength(6);
    const detail = await p.articles.getBySlug(
      CURRENT_USER_ID,
      'everest-base-camp-te-12-gun-gun-gun-notlarim',
    );
    expect(detail?.commentsCount).toBe(6);
    const notifications = await p.notifications.list('u_elif');
    expect(notifications.some((n) => n.type === 'comment' && n.senderId === CURRENT_USER_ID)).toBe(
      true,
    );
    await expect(p.articles.addComment(CURRENT_USER_ID, 'art_ebc_12', '   ')).rejects.toThrow();
  });

  it('yazarlar: bekleyen başvuru listelenmez, takip sayaç ve bildirim', async () => {
    const p = make();
    const writers = await p.articles.writers(CURRENT_USER_ID, null);
    expect(writers).toHaveLength(5);
    expect(writers.some((w) => w.userId === 'u_kerem')).toBe(false);
    expect(writers.find((w) => w.userId === 'u_elif')?.followedByMe).toBe(true);
    const dalis = await p.articles.writers(CURRENT_USER_ID, 'dalış');
    expect(dalis.map((w) => w.userId)).toEqual(['u_zeynep']);

    const pending = await p.articles.writer(CURRENT_USER_ID, 'u_kerem');
    expect(pending?.approvedAt).toBeNull();

    const before = await p.articles.writer(CURRENT_USER_ID, 'u_baris');
    const followed = await p.articles.toggleFollowWriter(CURRENT_USER_ID, 'u_baris');
    expect(followed.followedByMe).toBe(true);
    expect(followed.followerCount).toBe((before?.followerCount ?? 0) + 1);
    const unfollowed = await p.articles.toggleFollowWriter(CURRENT_USER_ID, 'u_baris');
    expect(unfollowed.followerCount).toBe(before?.followerCount);
    await expect(p.articles.toggleFollowWriter('u_elif', 'u_elif')).rejects.toThrow();
  });
});
