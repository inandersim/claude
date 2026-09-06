import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { CountryChecklist, ISODate } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/** Ülke listesi; arama sorgusu boşsa tam liste (destinasyon ülkeleri önce). */
export function useCountries(query: string | null) {
  const normalized = query?.trim() || null;
  return useQuery({
    queryKey: queryKeys.countries.list(normalized),
    queryFn: () => getDataProvider().countries.list(normalized),
    placeholderData: (prev) => prev,
  });
}

/** Tek ülke rehberi. */
export function useCountry(code: string) {
  return useQuery({
    queryKey: queryKeys.countries.detail(code),
    queryFn: () => getDataProvider().countries.getByCode(code),
    enabled: code.length === 2,
  });
}

/** Kullanıcının o ülke için kontrol listesi (yoksa boş oluşturulur). */
export function useCountryChecklist(code: string) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.countries.checklist(me.id, code),
    queryFn: () => getDataProvider().countries.checklist(me.id, code),
    enabled: code.length === 2,
  });
}

/** Belge işaretini aç/kapa; iyimser güncelleme ile anında yansır. */
export function useToggleDocument(code: string) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const key = queryKeys.countries.checklist(me.id, code);
  return useMutation({
    mutationFn: (documentKey: string) =>
      getDataProvider().countries.toggleDocument(me.id, code, documentKey),
    onMutate: async (documentKey) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CountryChecklist>(key);
      if (previous) {
        qc.setQueryData<CountryChecklist>(key, {
          ...previous,
          done: previous.done.includes(documentKey)
            ? previous.done.filter((k) => k !== documentKey)
            : [...previous.done, documentKey],
        });
      }
      return { previous };
    },
    onError: (_err, _key, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });
}

/** Seyahat tarihini ayarla ya da temizle (`null`). */
export function useSetTripDate(code: string) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const key = queryKeys.countries.checklist(me.id, code);
  return useMutation({
    mutationFn: (date: ISODate | null) =>
      getDataProvider().countries.setTripDate(me.id, code, date),
    onSuccess: (data) => qc.setQueryData(key, data),
  });
}
