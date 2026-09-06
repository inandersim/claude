import type { WeatherRepository } from '@/data/repositories';

import type { MockContext } from '../context';

const notReady = (): never => {
  throw new Error('weather modülü henüz uygulanmadı');
};

/** weather modülü mock repository fabrikası. */
export function createWeatherRepository(_ctx: MockContext): WeatherRepository {
  return new Proxy({} as WeatherRepository, { get: () => notReady });
}
