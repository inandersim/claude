import { seedSpecies } from '@/data/mock/seed.wildlife';
import {
  DETERRENT_ANIMALS,
  DETERRENT_PROFILES,
  dangerMeta,
  dangerRank,
  deterrentProfile,
  encounterAdvice,
  filterSpecies,
  localIdentify,
  matchSpecies,
  onlineHelperEstimate,
  parseSpeciesResponse,
  playPlan,
  questionUrgency,
  soundMeta,
  speciesForCountry,
  wildlifeCountryFromCoords,
} from '@/domain';

const KACKAR = { latitude: 40.85, longitude: 41.2 };
const NEPAL = { latitude: 28.3, longitude: 83.8 };

describe('localIdentify', () => {
  it('engerek tanımı → Vipera üstte, güven 0.2–0.6', () => {
    const r = localIdentify(
      'gri, 70 cm, sırtında zigzag, üçgen kafa, kayalıkta',
      KACKAR,
      seedSpecies,
    );
    expect(r.source).toBe('local');
    expect(r.candidates.length).toBeGreaterThan(0);
    const top = r.candidates[0]!;
    expect(top.name).toMatch(/engerek/i);
    expect(['sp_vipera_ammodytes', 'sp_montivipera_xanthina']).toContain(top.speciesId);
    for (const c of r.candidates) {
      expect(c.confidence).toBeGreaterThanOrEqual(0.2);
      expect(c.confidence).toBeLessThanOrEqual(0.6);
    }
    // Güven azalan sırada
    const confs = r.candidates.map((c) => c.confidence);
    expect([...confs].sort((a, b) => b - a)).toEqual(confs);
  });

  it('"siyah uzun" → kara yılan; "kahverengi büyük memeli" → ayı', () => {
    const snake = localIdentify('siyah uzun ince yılan, çok hızlı kaçtı', KACKAR, seedSpecies);
    expect(snake.candidates[0]?.speciesId).toBe('sp_dolichophis_caspius');
    const bear = localIdentify('kahverengi büyük memeli, ormanda', KACKAR, seedSpecies);
    expect(bear.candidates[0]?.speciesId).toBe('sp_ursus_arctos');
  });

  it('ülke, bölge dışı türleri geri iter; Nepal koordinatında krait öne çıkar', () => {
    const r = localIdentify('siyah, beyaz halkalı yılan, gece', NEPAL, seedSpecies);
    expect(r.candidates[0]?.speciesId).toBe('sp_bungarus_caeruleus');
    expect(wildlifeCountryFromCoords(NEPAL)).toBe('NP');
    expect(wildlifeCountryFromCoords(KACKAR)).toBe('TR');
    expect(wildlifeCountryFromCoords(null)).toBeNull();
  });

  it('boş açıklama: ülkenin tehlikeli türleri düşük güvenle ve tavsiyeyle döner', () => {
    const r = localIdentify('', KACKAR, seedSpecies);
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates.every((c) => c.confidence === 0.2)).toBe(true);
    expect(r.advice.some((a) => a.includes('çevrimdışı'))).toBe(true);
  });
});

describe('filterSpecies / speciesForCountry', () => {
  it('sorgu, grup, tehlike ve ülke filtreleri; tehlikeliler önce', () => {
    const snakes = filterSpecies(seedSpecies, { group: 'snake' });
    expect(snakes.every((s) => s.group === 'snake')).toBe(true);
    expect(dangerRank(snakes[0]!.danger)).toBeGreaterThanOrEqual(dangerRank(snakes.at(-1)!.danger));
    const deadlyTr = filterSpecies(seedSpecies, { danger: 'deadly', countryCode: 'tr' });
    expect(deadlyTr.length).toBeGreaterThan(0);
    expect(deadlyTr.every((s) => s.danger === 'deadly' && s.countryCodes.includes('TR'))).toBe(
      true,
    );
    const byLatin = filterSpecies(seedSpecies, { query: 'Macrovipera' });
    expect(byLatin.map((s) => s.id)).toEqual(['sp_macrovipera_lebetinus']);
    const byWord = filterSpecies(seedSpecies, { query: 'KKKA' });
    expect(byWord[0]?.id).toBe('sp_hyalomma_marginatum');
    expect(filterSpecies(seedSpecies, { query: 'zzzz-yok' })).toEqual([]);
  });

  it('speciesForCountry AU → yalnızca Avustralya türleri', () => {
    const au = speciesForCountry(seedSpecies, 'AU');
    expect(au.length).toBeGreaterThan(0);
    expect(au.every((s) => s.countryCodes.includes('AU'))).toBe(true);
    expect(speciesForCountry(seedSpecies, null).length).toBe(seedSpecies.length);
  });

  it('seed: 40 tür, benzersiz kimlikler, ilk yardım slug’ları geçerli', () => {
    expect(seedSpecies.length).toBe(40);
    expect(new Set(seedSpecies.map((s) => s.id)).size).toBe(40);
    const slugs = new Set([
      'cpr',
      'bleeding',
      'fracture',
      'hypothermia',
      'heat',
      'altitude',
      'snakebite',
      'anaphylaxis',
      'drowning',
      'burns',
      'lightning',
      'avalanche',
    ]);
    for (const s of seedSpecies) if (s.firstAidSlug) expect(slugs.has(s.firstAidSlug)).toBe(true);
  });
});

describe('dangerMeta', () => {
  it('her düzeyin rengi, ikonu ve çeviri anahtarı var; sıralama artan', () => {
    expect(dangerMeta('harmless')).toMatchObject({
      colorKey: 'success',
      labelKey: 'wildlife.danger.harmless',
      rank: 0,
    });
    expect(dangerMeta('caution').colorKey).toBe('info');
    expect(dangerMeta('dangerous').colorKey).toBe('warning');
    expect(dangerMeta('deadly')).toMatchObject({
      colorKey: 'danger',
      icon: 'shield-alert',
      rank: 3,
    });
  });
});

describe('DETERRENT_PROFILES / playPlan', () => {
  it('her hayvan için profil, ≥2 ses, kanıt cümlesi ve davranış listeleri', () => {
    expect(DETERRENT_PROFILES.length).toBe(DETERRENT_ANIMALS.length);
    for (const animal of DETERRENT_ANIMALS) {
      const p = deterrentProfile(animal);
      expect(p.sounds.length).toBeGreaterThanOrEqual(2);
      expect(p.evidence).toMatch(/kanıt sınırlı/i);
      expect(p.behaviorDo.length).toBeGreaterThan(0);
      expect(p.behaviorDont.length).toBeGreaterThan(0);
      // Etkinlik azalan sırada
      const eff = p.sounds.map((s) => s.effectiveness);
      expect([...eff].sort((a, b) => b - a)).toEqual(eff);
    }
  });

  it('yılan için stomp ilk sırada; ayı için bağırma önce, zil son', () => {
    expect(deterrentProfile('snake').sounds[0]?.sound).toBe('stomp');
    const bear = deterrentProfile('bear').sounds.map((s) => s.sound);
    expect(bear[0]).toBe('shout');
    expect(bear.indexOf('whistle')).toBe(bear.length - 1);
  });

  it('playPlan: önerilen ses, alternatifler, tekrar ve flaş/titreşim', () => {
    const snake = playPlan('snake');
    expect(snake.sound).toBe('stomp');
    expect(snake.noteKey).toBe('wildlife.panic.noteSnake');
    expect(snake.flash).toBe(false);
    expect(snake.repeat).toBe(5);
    const bear = playPlan('bear');
    expect(bear.sound).toBe('shout');
    expect(bear.alternatives).toContain('air_horn');
    expect(bear.flash).toBe(true);
    expect(bear.loop).toBe(true);
    expect(bear.durationS).toBe(soundMeta('shout').durationS);
  });

  it('soundMeta: dosya adı ve süre', () => {
    expect(soundMeta('air_horn')).toMatchObject({ file: 'air_horn.wav', durationS: 3 });
    expect(soundMeta('ultrasonic').limited).toBe(true);
    expect(soundMeta('siren').labelKey).toBe('wildlife.sound.siren');
  });
});

describe('questionUrgency / encounterAdvice', () => {
  const viper = seedSpecies.find((s) => s.id === 'sp_macrovipera_lebetinus')!;
  const fox = seedSpecies.find((s) => s.id === 'sp_vulpes_vulpes')!;

  it('ısırık/belirti → urgent; canlı karşılaşma → watch; sıradan → none', () => {
    expect(questionUrgency('Yılan ısırdı, eli şişiyor', null)).toBe('urgent');
    expect(questionUrgency('Şu an çadırın yanında bir tilki var', fox)).toBe('watch');
    expect(questionUrgency('Şu an karşımda duruyor', viper)).toBe('urgent');
    expect(questionUrgency('Geçen yaz gördüğüm yılan hangi tür?', null)).toBe('none');
    expect(questionUrgency('Bu ne olabilir?', viper)).toBe('watch');
  });

  it('encounterAdvice: ölümcül türde hayati uyarı ilk sırada, ilk yardım notu var', () => {
    const steps = encounterAdvice(viper);
    expect(steps[0]).toMatch(/HAYATİ/);
    expect(steps.some((s) => s.includes('ilk yardım'))).toBe(true);
    expect(steps.length).toBeLessThanOrEqual(8);
    expect(encounterAdvice(fox)[0]).toBe(fox.encounterDo[0]);
  });
});

describe('parseSpeciesResponse / matchSpecies', () => {
  it('latince ad ile yerel tür eşleşir, yerel tehlike düzeyi esas alınır', () => {
    const r = parseSpeciesResponse(
      {
        candidates: [
          {
            name: 'Nose-horned viper',
            scientificName: 'Vipera ammodytes',
            confidence: 0.7,
            danger: 'caution',
          },
          { name: 'Bilinmeyen', scientificName: 'Xus yus', confidence: 0.2, danger: 'nonsense' },
          { name: 'Kara yılan', scientificName: '', confidence: 0.9 },
        ],
        advice: ['Mesafeni koru', '', 42],
      },
      seedSpecies,
    );
    expect(r.source).toBe('remote');
    expect(r.candidates[0]).toMatchObject({
      speciesId: 'sp_dolichophis_caspius',
      confidence: 0.9,
      danger: 'harmless',
    });
    const viper = r.candidates.find((c) => c.speciesId === 'sp_vipera_ammodytes')!;
    expect(viper.danger).toBe('dangerous');
    expect(viper.name).toBe('Boynuzlu engerek');
    const unknown = r.candidates.find((c) => c.speciesId === null)!;
    expect(unknown).toMatchObject({ name: 'Bilinmeyen', danger: 'caution' });
    expect(r.advice).toEqual(['Mesafeni koru']);
  });

  it('bozuk yanıt boş liste döner', () => {
    expect(parseSpeciesResponse(null, seedSpecies).candidates).toEqual([]);
    expect(parseSpeciesResponse({ candidates: 'x' }, seedSpecies).candidates).toEqual([]);
    expect(matchSpecies(seedSpecies, 'Ursus arctos horribilis', null)?.id).toBe('sp_ursus_arctos');
    expect(matchSpecies(seedSpecies, null, 'köse mantarı')?.id).toBe('sp_amanita_phalloides');
    expect(matchSpecies(seedSpecies, null, 'yok böyle')).toBeNull();
  });
});

describe('onlineHelperEstimate', () => {
  it('12–140 aralığında, deterministik, gece düşük, akşam yüksek', () => {
    const night = new Date(2026, 8, 7, 4, 0);
    const evening = new Date(2026, 8, 7, 20, 0);
    expect(onlineHelperEstimate(night)).toBe(onlineHelperEstimate(night.getTime()));
    expect(onlineHelperEstimate(night)).toBeGreaterThanOrEqual(12);
    expect(onlineHelperEstimate(evening)).toBeLessThanOrEqual(140);
    expect(onlineHelperEstimate(evening)).toBeGreaterThan(onlineHelperEstimate(night) * 3);
    for (let h = 0; h < 24; h += 1) {
      const v = onlineHelperEstimate(new Date(2026, 8, 5, h, 30));
      expect(v).toBeGreaterThanOrEqual(12);
      expect(v).toBeLessThanOrEqual(140);
    }
  });
});
