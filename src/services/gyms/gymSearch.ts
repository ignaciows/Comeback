import type { EquipmentAvailability, EquipmentId } from '@/domain/types';
import { UNKNOWN_EQUIPMENT, matchChain, type ChainProfile } from '@/data/gymChains';

/**
 * Gym search over OpenStreetMap.
 *
 * Overpass is free, needs no key and no account, and its coverage of gyms in
 * German cities is good. What it does *not* have is equipment, so that comes
 * from the chain profiles and is labelled as typical-for-the-chain rather than
 * confirmed. Nothing here invents a fact about a specific gym.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Overpass rejects anonymous clients with a 406 and its usage policy asks
 * callers to identify themselves, so the app says who it is.
 */
const USER_AGENT = 'Comeback/0.1 (training app; gym search)';

/** Cities the app can search without a location permission. */
export const CITIES = [
  { id: 'cologne', label: 'Cologne', lat: 50.9375, lon: 6.9603 },
  { id: 'dusseldorf', label: 'Düsseldorf', lat: 51.2277, lon: 6.7735 },
  { id: 'bonn', label: 'Bonn', lat: 50.7374, lon: 7.0982 },
  { id: 'berlin', label: 'Berlin', lat: 52.52, lon: 13.405 },
  { id: 'hamburg', label: 'Hamburg', lat: 53.5511, lon: 9.9937 },
  { id: 'munich', label: 'Munich', lat: 48.1351, lon: 11.582 },
];

export type GymSearchResult = {
  id: string;
  name: string;
  chain: ChainProfile | null;
  lat: number;
  lon: number;
  distanceMeters: number;
  address: string | null;
  openingHours: string | null;
  website: string | null;
  equipment: Partial<Record<EquipmentId, EquipmentAvailability>>;
  /** Where the equipment list came from, so the UI can be honest about it. */
  equipmentSource: 'chain' | 'unknown';
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Metres between two coordinates (haversine). */
export function distanceBetween(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): number {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:street'];
  const number = tags['addr:housenumber'];
  const city = tags['addr:city'];
  const parts = [street && number ? `${street} ${number}` : street, city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * OSM files yoga studios, pilates rooms and martial-arts gyms under the same
 * `fitness_centre` tag as a place with racks and barbells. Around Cologne
 * centre that is a third of the results, which is not what someone looking for
 * somewhere to lift needs to scroll through.
 *
 * The `sport` tag decides it where present — that is real data, not a guess.
 * Where it is absent, only unambiguous disciplines are read out of the name;
 * anything uncertain is kept, because dropping a real gym is the worse error.
 */
const STRENGTH_SPORTS = ['fitness', 'weightlifting', 'gym', 'bodybuilding', 'crossfit', 'multi'];
const NON_STRENGTH_NAMES = [
  'yoga',
  'pilates',
  'barre',
  'muay thai',
  'mma',
  'pole fitness',
  'pole dance',
  'capoeira',
  'ballett',
  'tanzschule',
];

export function isStrengthGym(tags: Record<string, string>): boolean {
  const sport = tags.sport;
  if (sport) {
    // A tag like "fitness;yoga;gymnastics" still means there is a gym floor.
    return sport
      .split(';')
      .some((value) => STRENGTH_SPORTS.includes(value.trim().toLowerCase()));
  }
  const name = `${tags.name ?? ''}`.toLowerCase();
  return !NON_STRENGTH_NAMES.some((word) => name.includes(word));
}

/** Turns one Overpass element into a result, or null if it is unusable. */
export function toResult(
  element: OverpassElement,
  origin: { lat: number; lon: number },
): GymSearchResult | null {
  const tags = element.tags ?? {};
  const name = tags.name ?? tags.brand;
  if (!name) return null;
  if (!isStrengthGym(tags)) return null;

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat === undefined || lon === undefined) return null;

  const chain = matchChain(name, tags.brand);

  return {
    id: `${element.type}/${element.id}`,
    name,
    chain,
    lat,
    lon,
    distanceMeters: distanceBetween(origin, { lat, lon }),
    address: buildAddress(tags),
    openingHours: tags.opening_hours ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    equipment: chain ? chain.equipment : UNKNOWN_EQUIPMENT,
    equipmentSource: chain ? 'chain' : 'unknown',
  };
}

export type SearchOptions = {
  lat: number;
  lon: number;
  /** Search radius in metres. */
  radius?: number;
  signal?: AbortSignal;
};

/**
 * Finds gyms around a point. Falls back to a second Overpass mirror, because
 * the main one rate-limits and this should not be a dead end when it does.
 */
export async function searchGyms({
  lat,
  lon,
  radius = 3000,
  signal,
}: SearchOptions): Promise<GymSearchResult[]> {
  const query = `[out:json][timeout:20];(node["leisure"="fitness_centre"](around:${radius},${lat},${lon});way["leisure"="fitness_centre"](around:${radius},${lat},${lon}););out center tags 60;`;

  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!response.ok) {
        lastError = new Error(`Overpass responded ${response.status}`);
        continue;
      }
      const payload = (await response.json()) as { elements?: OverpassElement[] };
      const results = (payload.elements ?? [])
        .map((element) => toResult(element, { lat, lon }))
        .filter((result): result is GymSearchResult => result !== null)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      // Overpass returns a node and a way for the same building sometimes.
      const seen = new Set<string>();
      return results.filter((result) => {
        const key = `${result.name}|${Math.round(result.distanceMeters / 50)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not reach the map service');
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** How many equipment categories a gym is known to have. */
export function equipmentSummary(result: GymSearchResult): string {
  const available = Object.values(result.equipment).filter((value) => value === 'available').length;
  const unavailable = Object.values(result.equipment).filter((value) => value === 'unavailable').length;

  const categories = `${available} ${available === 1 ? 'category' : 'categories'}`;

  if (result.equipmentSource === 'unknown') return 'Equipment unknown';
  if (unavailable > 0) return `${categories} · ${unavailable} missing`;
  return `${categories} of equipment`;
}
