import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });

describe('Social — akış', () => {
  it('sekmeler ve zenginleştirme', async () => {
    const p = make();
    const all = await p.social.feed(CURRENT_USER_ID, { tab: 'all' });
    expect(all.length).toBeGreaterThan(20);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]!.createdAt >= all[i]!.createdAt).toBe(true);
    }
    const status = await p.social.feed(CURRENT_USER_ID, { tab: 'status' });
    expect(status.every((x) => x.kind === 'status' || x.kind === 'photo')).toBe(true);
    expect(status.length).toBe(14);
    const adventures = await p.social.feed(CURRENT_USER_ID, { tab: 'adventures' });
    expect(adventures.every((x) => (x.kind ?? 'adventure') === 'adventure')).toBe(true);
    const following = await p.social.feed(CURRENT_USER_ID, { tab: 'following' });
    expect(
      following.every((x) =>
        ['u_me', 'u_elif', 'u_can', 'u_zeynep', 'u_kerem'].includes(x.authorId),
      ),
    ).toBe(true);

    const s1 = all.find((x) => x.id === 's1')!;
    expect(s1.myReaction).toBe('fire');
    expect(s1.likedByMe).toBe(true);
    expect(s1.savedByMe).toBe(true);
    expect(s1.reactionCounts?.fire).toBe(3);
    expect(s1.mentions).toContain(CURRENT_USER_ID);

    const repost = all.find((x) => x.id === 's13')!;
    expect(repost.repostOf?.id).toBe('s1');
    expect(repost.repostOf?.author.id).toBe('u_elif');
    // Eski beğeni 'like' tepkisi olarak görünür
    const p2 = all.find((x) => x.id === 'p2')!;
    expect(p2.myReaction).toBe('like');
  });
});

describe('Social — tepki', () => {
  it('react likes tablosu ve likesCount ile senkron kalır', async () => {
    const p = make();
    const before = (await p.feed.getById(CURRENT_USER_ID, 'p4'))!;
    expect(before.likedByMe).toBe(false);

    const fired = await p.social.react(CURRENT_USER_ID, 'p4', 'fire');
    expect(fired.myReaction).toBe('fire');
    expect(fired.likesCount).toBe(before.likesCount + 1);
    expect(fired.reactionCounts?.fire).toBe(1);
    const oldFeed = (await p.feed.getById(CURRENT_USER_ID, 'p4'))!;
    expect(oldFeed.likedByMe).toBe(true);
    expect(oldFeed.likesCount).toBe(before.likesCount + 1);

    // Tür değişince sayaç değişmez
    const loved = await p.social.react(CURRENT_USER_ID, 'p4', 'love');
    expect(loved.likesCount).toBe(before.likesCount + 1);
    expect(loved.reactionCounts?.fire).toBe(0);
    expect(loved.reactionCounts?.love).toBe(1);

    // Kaldırınca eski beğeni de gider
    const removed = await p.social.react(CURRENT_USER_ID, 'p4', null);
    expect(removed.myReaction).toBeNull();
    expect(removed.likesCount).toBe(before.likesCount);
    expect((await p.feed.getById(CURRENT_USER_ID, 'p4'))!.likedByMe).toBe(false);

    // Eski toggleLike sonrası react, ikinci kez saymaz
    await p.feed.toggleLike(CURRENT_USER_ID, 'p4');
    const again = await p.social.react(CURRENT_USER_ID, 'p4', 'wow');
    expect(again.likesCount).toBe(before.likesCount + 1);

    const notes = await p.notifications.list('u_mert');
    expect(notes.some((n) => n.type === 'reaction' && n.postId === 'p4')).toBe(true);
  });
});

describe('Social — kaydetme ve koleksiyon', () => {
  it('toggleSave sayaçları ve koleksiyon sayısını günceller', async () => {
    const p = make();
    const saved = await p.social.toggleSave(CURRENT_USER_ID, 'p5', 'col_me_go');
    expect(saved.savedByMe).toBe(true);
    expect(saved.savesCount).toBe(1);
    let cols = await p.social.collections(CURRENT_USER_ID);
    expect(cols.find((c) => c.id === 'col_me_go')?.count).toBe(3);
    const inCol = await p.social.savedPosts(CURRENT_USER_ID, 'col_me_go');
    expect(inCol[0]?.id).toBe('p5');

    const unsaved = await p.social.toggleSave(CURRENT_USER_ID, 'p5');
    expect(unsaved.savedByMe).toBe(false);
    expect(unsaved.savesCount).toBe(0);
    cols = await p.social.collections(CURRENT_USER_ID);
    expect(cols.find((c) => c.id === 'col_me_go')?.count).toBe(2);

    const all = await p.social.savedPosts(CURRENT_USER_ID);
    expect(all.length).toBe(5);
    await expect(p.social.toggleSave(CURRENT_USER_ID, 'p6', 'yok')).rejects.toThrow();
  });

  it('createCollection ad doğrular ve tekrarı döner', async () => {
    const p = make();
    const created = await p.social.createCollection(CURRENT_USER_ID, '  Kış rotaları ');
    expect(created.name).toBe('Kış rotaları');
    const again = await p.social.createCollection(CURRENT_USER_ID, 'kış rotaları');
    expect(again.id).toBe(created.id);
    await expect(p.social.createCollection(CURRENT_USER_ID, '  ')).rejects.toThrow();
  });
});

describe('Social — durum, repost, etiket, silme', () => {
  it('createStatus etiket/mention ayrıştırır ve mention bildirimi üretir', async () => {
    const p = make();
    const post = await p.social.createStatus(CURRENT_USER_ID, {
      caption: 'Yeni rota #Kaçkar @elif.dogan ile',
      imageUris: ['file://a.jpg', 'file://b.jpg'],
      locationName: null,
    });
    expect(post.kind).toBe('photo');
    expect(post.images).toHaveLength(2);
    expect(post.hashtags).toEqual(['kaçkar']);
    expect(post.mentions).toEqual(['u_elif']);
    expect(post.locationName).toBe('Kadıköy, İstanbul');
    const notes = await p.notifications.list('u_elif');
    expect(notes.some((n) => n.type === 'mention' && n.postId === post.id)).toBe(true);
    await expect(
      p.social.createStatus(CURRENT_USER_ID, { caption: ' ', imageUris: [], locationName: null }),
    ).rejects.toThrow();
  });

  it('repost sayaç artırır, köke bağlanır ve bildirim üretir', async () => {
    const p = make();
    const before = (await p.feed.getById(CURRENT_USER_ID, 's1'))!;
    const repost = await p.social.repost(CURRENT_USER_ID, 's13', 'Katılıyorum #kaçkar');
    expect(repost.repostOfId).toBe('s1');
    expect(repost.repostOf?.id).toBe('s1');
    expect(repost.kind).toBe('status');
    const after = (await p.feed.getById(CURRENT_USER_ID, 's1'))!;
    expect(after.repostsCount).toBe((before.repostsCount ?? 0) + 1);
    const notes = await p.notifications.list('u_elif');
    expect(notes.some((n) => n.type === 'repost' && n.postId === 's1')).toBe(true);

    await p.social.deletePost(CURRENT_USER_ID, repost.id);
    expect((await p.feed.getById(CURRENT_USER_ID, 's1'))!.repostsCount).toBe(before.repostsCount);
  });

  it('hashtags / byHashtag / searchUsers', async () => {
    const p = make();
    const tags = await p.social.hashtags(5);
    expect(tags).toHaveLength(5);
    expect(tags[0]?.tag).toBe('kaçkar');
    const kackar = await p.social.byHashtag(CURRENT_USER_ID, '#Kaçkar');
    expect(kackar.length).toBeGreaterThan(3);
    expect(kackar.every((x) => x.hashtags?.includes('kaçkar'))).toBe(true);
    const found = await p.social.searchUsers('@eli');
    expect(found[0]?.username).toBe('elif.dogan');
  });

  it('deletePost yalnızca yazar; kayıt ve tepkileri temizler', async () => {
    const p = make();
    await expect(p.social.deletePost(CURRENT_USER_ID, 's1')).rejects.toThrow();
    await p.social.deletePost(CURRENT_USER_ID, 's5');
    expect(await p.feed.getById(CURRENT_USER_ID, 's5')).toBeNull();
    const feed = await p.social.feed(CURRENT_USER_ID, { tab: 'all' });
    expect(feed.some((x) => x.id === 's5')).toBe(false);
  });
});
