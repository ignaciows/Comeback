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

/** Turns one Overpass element into a result, or null if it is unusable. */
export function toResult(
  element: OverpassElement,
  origin: { lat: number; lon: number },
): GymSearchResult | null {
  const tags = element.tags ?? {};
  const name = tags.name ?? tags.brand;
  if (!name) return null;

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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

  if (result.equipmentSource === 'unknown') return 'Equipment unknown';
  if (unavailable > 0) return `${available} categories · ${unavailable} missing`;
  return `${available} equipment categories`;
}
