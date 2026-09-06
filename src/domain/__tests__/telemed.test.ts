import {
  activeConsultation,
  buildConsultSummary,
  canSend,
  consultDurationMin,
  consultStatusMeta,
  doctorGreeting,
  doctorReplyFor,
  guessLocale,
  localTriage,
  matchDoctors,
  sortDoctorsForList,
  specialtyFor,
  urgencyMeta,
} from '../telemed';
import type { Doctor } from '../types';

const doctor = (o: Partial<Doctor>): Doctor => ({
  id: 'd',
  userId: 'u',
  title: 'Dr.',
  specialties: ['general'],
  languages: ['tr'],
  licenseNo: 'TR-****-0000',
  institution: 'Hastane',
  isVerified: true,
  isOnline: true,
  responseMin: 5,
  rating: 4.5,
  consultCount: 10,
  volunteer: false,
  priceTryPerConsult: 500,
  countryCodes: ['TR'],
  bio: '',
  ...o,
});

describe('localTriage', () => {
  it('yılan ısırığı → high, snakebite rehberi, 112 önerisi, turnike yasağı', () => {
    const r = localTriage('Arkadaşımı yılan ısırdı, bileği şişiyor', 'tr');
    expect(r.kind).toBe('snakebite');
    expect(r.urgency).toBe('high');
    expect(r.firstAidSlug).toBe('snakebite');
    expect(r.callEmergency).toBe(true);
    expect(r.steps.some((s) => s.includes('Turnike YOK'))).toBe(true);
    expect(r.steps.some((s) => s.includes('112'))).toBe(true);
  });

  it('İngilizce şikâyet İngilizce adımlar üretir', () => {
    const r = localTriage('My friend was bitten by a viper on the ankle', 'en');
    expect(r.kind).toBe('snakebite');
    expect(r.steps[1]).toMatch(/NO tourniquet/);
  });

  it('anafilaksi → critical + adrenalin', () => {
    const r = localTriage('Arı soktu, dudakları şişti, alerjisi var', 'tr');
    expect(r.kind).toBe('anaphylaxis');
    expect(r.urgency).toBe('critical');
    expect(r.firstAidSlug).toBe('anaphylaxis');
    expect(r.callEmergency).toBe(true);
    expect(r.steps[0]).toMatch(/Adrenalin/);
  });

  it('AMS/HAPE → altitude rehberi ve "İN" talimatı', () => {
    const r = localTriage('3800 metrede baş ağrısı, kusma, irtifa hastalığı sanırım', 'tr');
    expect(r.kind).toBe('altitude');
    expect(r.urgency).toBe('high');
    expect(r.firstAidSlug).toBe('altitude');
    expect(r.steps[0]).toMatch(/^İN!/);
  });

  it('nefes darlığı her durumu critical yapar', () => {
    const r = localTriage('Bileğim kırıldı sanırım ve nefes darlığım var', 'tr');
    expect(r.kind).toBe('fracture');
    expect(r.urgency).toBe('critical');
    expect(r.callEmergency).toBe(true);
  });

  it('kene → low, 112 gerekmez; dalış → critical', () => {
    const tick = localTriage('Bacağımda kene buldum', 'tr');
    expect(tick.kind).toBe('tick');
    expect(tick.urgency).toBe('low');
    expect(tick.callEmergency).toBe(false);
    const dive = localTriage('Dalıştan sonra eklem ağrısı ve baş dönmesi', 'tr');
    expect(dive.kind).toBe('dive');
    expect(dive.urgency).toBe('critical');
    expect(dive.steps.some((s) => s.includes('basınç odası'))).toBe(true);
  });

  it('eşleşme yoksa tür ipucu (species) kullanılır; hiç yoksa genel değerlendirme', () => {
    const withSpecies = localTriage('Ayağımda iki delik ve morluk var', 'tr', {
      firstAidSlug: 'snakebite',
      danger: 'deadly',
    });
    expect(withSpecies.kind).toBe('snakebite');
    const unknown = localTriage('Karnım ağrıyor ve midem bulanıyor', 'tr');
    expect(unknown.kind).toBe('unknown');
    expect(unknown.urgency).toBe('medium');
    expect(unknown.firstAidSlug).toBeNull();
    expect(unknown.steps.length).toBeGreaterThan(0);
  });
});

describe('specialtyFor', () => {
  it('türe göre uzmanlık', () => {
    expect(specialtyFor('snakebite')).toBe('toxicology');
    expect(specialtyFor('sting')).toBe('toxicology');
    expect(specialtyFor('altitude')).toBe('altitude_medicine');
    expect(specialtyFor('dive')).toBe('dive_medicine');
    expect(specialtyFor('fracture')).toBe('orthopedics');
    expect(specialtyFor('hypothermia')).toBe('wilderness');
    expect(specialtyFor('bleeding')).toBe('emergency');
    expect(specialtyFor(localTriage('bilmiyorum', 'tr'))).toBe('general');
  });
});

describe('matchDoctors', () => {
  const tox = doctor({ id: 'tox', specialties: ['toxicology'], responseMin: 6, isOnline: true });
  const fast = doctor({ id: 'fast', specialties: ['emergency'], responseMin: 2, isOnline: true });
  const offline = doctor({
    id: 'off',
    specialties: ['toxicology'],
    responseMin: 1,
    isOnline: false,
  });
  const foreign = doctor({
    id: 'de',
    specialties: ['toxicology'],
    languages: ['de'],
    countryCodes: ['DE'],
    responseMin: 3,
  });

  it('çevrimiçi + uzmanlık + dil + ülke önceliği', () => {
    const ranked = matchDoctors([fast, foreign, tox, offline], 'toxicology', 'high', 'TR');
    expect(ranked.map((d) => d.id)).toEqual(['tox', 'fast', 'de']);
    expect(ranked.some((d) => d.id === 'off')).toBe(false);
  });

  it('kritik durumda en hızlı yanıt öne geçer', () => {
    const ranked = matchDoctors([tox, fast, foreign], 'toxicology', 'critical', 'TR');
    expect(ranked[0]?.id).toBe('fast');
  });

  it('requireOnline=false ile çevrimdışılar sona eklenir', () => {
    const ranked = matchDoctors([offline, tox], 'toxicology', 'low', 'TR', {
      requireOnline: false,
    });
    expect(ranked.map((d) => d.id)).toEqual(['tox', 'off']);
  });

  it('liste sıralaması: çevrimiçi önce, sonra puan', () => {
    const a = doctor({ id: 'a', isOnline: false, rating: 5 });
    const b = doctor({ id: 'b', isOnline: true, rating: 4.2 });
    const c = doctor({ id: 'c', isOnline: true, rating: 4.9 });
    expect(sortDoctorsForList([a, b, c]).map((d) => d.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('danışma kuralları', () => {
  it('canSend: yalnızca taraflar ve açık danışmalarda', () => {
    const base = { status: 'active' as const, patientId: 'p', doctor: { userId: 'd' } };
    expect(canSend(base, 'p')).toBe(true);
    expect(canSend(base, 'd')).toBe(true);
    expect(canSend(base, 'x')).toBe(false);
    expect(canSend({ ...base, status: 'completed' }, 'p')).toBe(false);
    expect(canSend({ ...base, status: 'requested', doctor: null }, 'p')).toBe(true);
    expect(canSend({ status: 'active', patientId: 'p', doctorUserId: 'd' }, 'd')).toBe(true);
  });

  it('consultDurationMin kabulden bitişe kadar dakika', () => {
    const c = {
      createdAt: '2026-09-01T10:00:00.000Z',
      acceptedAt: '2026-09-01T10:02:00.000Z',
      endedAt: '2026-09-01T10:38:30.000Z',
    };
    expect(consultDurationMin(c)).toBe(37);
    expect(consultDurationMin({ ...c, endedAt: null }, new Date('2026-09-01T10:12:00.000Z'))).toBe(
      10,
    );
  });

  it('buildConsultSummary talimatları maddeler', () => {
    const summary = buildConsultSummary(
      [
        { content: 'Yılan ısırdı', isInstruction: false, senderId: 'p' },
        { content: 'Bacağı hareketsiz tutun.', isInstruction: true, senderId: 'd' },
        { content: 'Turnike yok.', isInstruction: true, senderId: 'd' },
      ],
      'tr',
    );
    expect(summary).toBe('Doktor talimatları:\n• Bacağı hareketsiz tutun.\n• Turnike yok.');
    expect(buildConsultSummary([], 'en')).toBe('No instructions recorded.');
    // Talimat işaretli mesaj yoksa doktor mesajlarının son üçü
    const fallback = buildConsultSummary(
      [
        { content: 'a', isInstruction: false, senderId: 'p' },
        { content: 'b', isInstruction: false, senderId: 'd' },
      ],
      'en',
      'p',
    );
    expect(fallback).toBe('Doctor instructions:\n• b');
  });

  it('status/urgency meta ve aktif danışma seçimi', () => {
    expect(consultStatusMeta('active').isOpen).toBe(true);
    expect(consultStatusMeta('cancelled').isOpen).toBe(false);
    expect(urgencyMeta('critical').rank).toBeGreaterThan(urgencyMeta('high').rank);
    const active = activeConsultation([
      { status: 'completed', createdAt: '2026-09-03T00:00:00Z' },
      { status: 'requested', createdAt: '2026-09-01T00:00:00Z' },
      { status: 'active', createdAt: '2026-09-02T00:00:00Z' },
    ]);
    expect(active?.status).toBe('active');
    expect(activeConsultation([])).toBeNull();
  });
});

describe('demo doktor yanıtları', () => {
  it('karşılama ve kural tabanlı talimat', () => {
    expect(doctorGreeting('Dr. Ayşe Kurt', 'tr')).toMatch(/^Merhaba, ben Dr\. Ayşe Kurt\./);
    expect(doctorReplyFor('Nefes darlığı başladı', 'tr')).toMatch(/112/);
    expect(doctorReplyFor('Şişlik var ve morardı', 'tr')).toMatch(/Turnike/);
    expect(doctorReplyFor('Hayır, nefes normal', 'tr')).toMatch(/panik yapmayın/);
    expect(doctorReplyFor('It hurts a lot', 'en')).toMatch(/paracetamol/);
    expect(doctorReplyFor('xyz', 'en')).toMatch(/Keep the patient calm/);
  });

  it('guessLocale', () => {
    expect(guessLocale('Arkadaşımı yılan ısırdı')).toBe('tr');
    expect(guessLocale('My friend was bitten by a snake')).toBe('en');
    expect(guessLocale('ok')).toBe('tr');
  });
});
