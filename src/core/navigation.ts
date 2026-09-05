import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/** Geçmiş yoksa (derin bağlantı ile açıldıysa) ana sayfaya döner. */
export function goBack(
  router: Router,
  fallback: '/' | '/explore' | '/live' | '/profile' = '/',
): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
