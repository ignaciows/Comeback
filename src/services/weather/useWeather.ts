import { useEffect } from 'react';

import { fetchWeather } from './weather';
import { useAppStore } from '@/store/useAppStore';

/** Readings older than this are refetched; weather does not change by the minute. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * Keeps the cached reading roughly current while weather is switched on.
 *
 * Deliberately lazy: it runs when the app starts and not on a timer, and it
 * skips entirely if the last reading is recent. Weather only changes the
 * wording of a nudge, so a two-hour-old reading is as good as a fresh one and
 * not worth a wake-up for.
 *
 * A failure is silent by design. There is nothing for the user to do about a
 * weather service being down, and a cached reading — or none at all — is a
 * perfectly good outcome.
 */
export function useWeatherSync(): void {
  const enabled = useAppStore((state) => state.weatherEnabled);
  const weather = useAppStore((state) => state.weather);
  const setWeather = useAppStore((state) => state.setWeather);

  const fetchedAt = weather?.fetchedAt ?? null;

  useEffect(() => {
    if (!enabled) return;

    const age = fetchedAt ? Date.now() - new Date(fetchedAt).getTime() : Infinity;
    if (age < STALE_AFTER_MS) return;

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        // Required lazily so a build without expo-location still starts.
        const moduleName = 'expo-location';
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Location = (require as unknown as (name: string) => typeof import('expo-location'))(moduleName);

        // Never prompts: weather is not worth a permission dialog the user did
        // not ask for. If location was already granted for gym search, this
        // uses it; otherwise weather simply stays off.
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted' || cancelled) return;

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
        if (cancelled) return;

        const outcome = await fetchWeather(
          position.coords.latitude,
          position.coords.longitude,
          controller.signal,
        );
        if (!cancelled && outcome.status === 'ok') setWeather(outcome.weather);
      } catch {
        // Nothing to surface: the nudge simply is not produced.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, fetchedAt, setWeather]);
}
