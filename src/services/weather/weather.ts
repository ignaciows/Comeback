import type { WeatherSnapshot } from '@/domain/nudges/nudges';

/**
 * Current conditions, for the one thing weather is used for: how the app
 * frames a training day.
 *
 * This is the only outbound network call in the app, and it is off unless the
 * user turns it on. Two decisions keep it defensible:
 *
 *  · **Open-Meteo** needs no account and no API key, so there is no identifier
 *    to correlate requests with.
 *  · **Coordinates are rounded to one decimal** — roughly 11 km — before they
 *    leave the device. That is more than precise enough to know whether it is
 *    raining on someone and far too coarse to say where they live.
 *
 * No health or training data is ever part of the request. A failure is not an
 * error state: weather is decoration on a nudge, so it degrades to null and
 * the nudge simply is not produced.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/** WMO weather codes, collapsed to the cases that change the message. */
function conditionFor(code: number): WeatherSnapshot['condition'] {
  if (code === 0 || code === 1) return 'clear';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloudy';
}

export type WeatherOutcome =
  | { status: 'ok'; weather: WeatherSnapshot }
  | { status: 'unavailable'; reason: string };

/** Deliberately coarse: a neighbourhood, not an address. */
function coarse(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WeatherOutcome> {
  try {
    const url =
      `${ENDPOINT}?latitude=${coarse(latitude)}&longitude=${coarse(longitude)}` +
      '&current=temperature_2m,weather_code';
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return { status: 'unavailable', reason: `Weather service returned ${response.status}` };
    }
    const body = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const current = body.current;
    if (!current || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') {
      return { status: 'unavailable', reason: 'Weather response was not in the expected shape' };
    }
    return {
      status: 'ok',
      weather: {
        condition: conditionFor(current.weather_code),
        temperatureC: current.temperature_2m,
      },
    };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Could not reach the weather service',
    };
  }
}
