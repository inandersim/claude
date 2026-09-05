/**
 * Düz veri nesneleri için derin kopya.
 * `structuredClone` Hermes'te bulunmadığından JSON tabanlı kopya kullanılır;
 * veri modelimizde tarihler ISO string olduğu için kayıpsızdır.
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
