import { formatCompact, formatTemperature, initials, isValidEmail } from '../format';

describe('formatCompact', () => {
  it('küçük sayıları olduğu gibi bırakır', () => {
    expect(formatCompact(999)).toBe('999');
  });
  it('binleri Türkçe "B" ile kısaltır', () => {
    expect(formatCompact(1500)).toBe('1,5B');
    expect(formatCompact(12345)).toBe('12B');
  });
  it('İngilizce için "K" kullanır', () => {
    expect(formatCompact(1500, 'en')).toBe('1.5K');
  });
  it('milyonları "M" ile gösterir', () => {
    expect(formatCompact(2_400_000)).toBe('2,4M');
  });
});

describe('formatTemperature', () => {
  it('yuvarlar ve derece işareti ekler', () => {
    expect(formatTemperature(-2.4)).toBe('-2°');
    expect(formatTemperature(24.6)).toBe('25°');
  });
});

describe('initials', () => {
  it('iki kelimenin baş harflerini alır', () => {
    expect(initials('Deniz Kaya')).toBe('DK');
  });
  it('Türkçe karakterleri doğru büyütür', () => {
    expect(initials('ilker şahin')).toBe('İŞ');
  });
  it('tek kelimede tek harf döner', () => {
    expect(initials('Zeynep')).toBe('Z');
  });
});

describe('isValidEmail', () => {
  it.each([
    ['deniz@zirve.app', true],
    ['a@b.co', true],
    ['gecersiz', false],
    ['a@b', false],
    ['  bosluk@ornek.com ', true],
  ])('%s → %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});
