import { LOCALES, type Locale } from '../languages';

import { i18n } from '..';

/**
 * Yer tutucu tuzağı: Türkçe yüzde işaretini **önüne** yazar ("%54"), bu yüzden
 * `%{{percent}}` metni i18n-js'in varsayılan `%{ad}` desenine takılır ve
 * değişken yerine `[missing ...]` basılır. İrtifa kartında ve kurs sınav
 * skorunda gerçekten görülen bir hataydı; bu paket geri gelmesini engeller.
 */
describe('i18n — değişken yerleştirme', () => {
  it('yüzde işaretinden hemen sonra gelen değişkeni doldurur', () => {
    i18n.locale = 'tr';
    const metin = i18n.t('altitude.metric.vsSeaLevel', { percent: 54 });
    expect(metin).toContain('54');
    expect(metin).toContain('%');
    expect(metin).not.toContain('missing');
  });

  it('kurs sınav skorunda da doldurur', () => {
    i18n.locale = 'tr';
    expect(i18n.t('courses.quiz.score', { correct: 8, total: 10, score: 80 })).toBe(
      '8/10 doğru · %80',
    );
    expect(i18n.t('courses.quiz.passHint', { score: 70 })).toContain('%70');
  });

  it('hiçbir dilde doldurulmamış yer tutucu bırakmaz', () => {
    // Tüm dillerde aynı iki metin: `%` + `{{}}` bitişikliği çeviriye de sızabilir.
    for (const locale of LOCALES as readonly Locale[]) {
      i18n.locale = locale;
      for (const key of ['altitude.metric.vsSeaLevel', 'courses.quiz.passHint'] as const) {
        const metin = i18n.t(key, { percent: 54, score: 70 });
        expect(`${locale}: ${metin}`).not.toContain('missing');
      }
    }
    i18n.locale = 'tr';
  });
});
