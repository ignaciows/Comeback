import type { EquipmentAvailability, EquipmentId } from '@/domain/types';

/**
 * What the big chains typically have.
 *
 * Public map data almost never lists gym equipment, but chains are
 * standardised: a McFit in Cologne has the same kit as a McFit anywhere. So
 * when a search result matches a known chain, its equipment is pre-filled from
 * here and clearly marked as *typical for the chain* rather than confirmed.
 * Anything the user checks on site overrides it.
 *
 * Kieser is the one that matters most to get right: machines only, no free
 * weights at all, which rules out most of the routines this app generates.
 */

export type ChainProfile = {
  id: string;
  /** Lower-case fragments matched against the OSM name/brand tags. */
  match: string[];
  label: string;
  note: string;
  equipment: Partial<Record<EquipmentId, EquipmentAvailability>>;
};

const FULL_GYM: Partial<Record<EquipmentId, EquipmentAvailability>> = {
  barbell: 'available',
  dumbbell: 'available',
  machine: 'available',
  cable: 'available',
  bench: 'available',
  rack: 'available',
  bodyweight: 'available',
  kettlebell: 'available',
  cardio: 'available',
  band: 'unsure',
};

export const GYM_CHAINS: ChainProfile[] = [
  {
    id: 'mcfit',
    match: ['mcfit', 'mc fit'],
    label: 'McFit',
    note: 'Full free-weight area, racks and heavy dumbbells. Busy at peak hours.',
    equipment: FULL_GYM,
  },
  {
    id: 'fitx',
    match: ['fitx', 'fit x'],
    label: 'FitX',
    note: 'Free weights, racks and a wide machine circuit.',
    equipment: FULL_GYM,
  },
  {
    id: 'cleverfit',
    match: ['clever fit', 'cleverfit'],
    label: 'Clever Fit',
    note: 'Standard full gym; free-weight area varies a little by location.',
    equipment: { ...FULL_GYM, kettlebell: 'unsure' },
  },
  {
    id: 'johnreed',
    match: ['john reed'],
    label: 'John Reed',
    note: 'Full equipment with a heavier free-weight section than most.',
    equipment: FULL_GYM,
  },
  {
    id: 'fitnessfirst',
    match: ['fitness first'],
    label: 'Fitness First',
    note: 'Full equipment plus classes and pool at some clubs.',
    equipment: FULL_GYM,
  },
  {
    id: 'holmesplace',
    match: ['holmes place'],
    label: 'Holmes Place',
    note: 'Premium club: full equipment, usually quieter.',
    equipment: FULL_GYM,
  },
  {
    id: 'fitone',
    match: ['fit/one', 'fitone', 'fit one'],
    label: 'Fit/One',
    note: 'Large floor with a complete free-weight area.',
    equipment: FULL_GYM,
  },
  {
    id: 'easyfitness',
    match: ['easyfitness', 'easy fitness'],
    label: 'EasyFitness',
    note: 'Full gym; smaller sites can be light on racks.',
    equipment: { ...FULL_GYM, rack: 'unsure' },
  },
  {
    id: 'superfit',
    match: ['superfit', 'super fit'],
    label: 'Superfit',
    note: 'Full equipment at most locations.',
    equipment: FULL_GYM,
  },
  {
    id: 'bodystreet',
    match: ['bodystreet'],
    label: 'Bodystreet',
    note: 'EMS studio — no conventional weights. Not suitable for these routines.',
    equipment: {
      barbell: 'unavailable',
      dumbbell: 'unavailable',
      machine: 'unavailable',
      cable: 'unavailable',
      rack: 'unavailable',
      bench: 'unavailable',
      bodyweight: 'available',
      cardio: 'unavailable',
    },
  },
  {
    id: 'kieser',
    match: ['kieser'],
    label: 'Kieser Training',
    note: 'Machines only — no barbells, dumbbells or racks. Most of the generated routines will not fit.',
    equipment: {
      barbell: 'unavailable',
      dumbbell: 'unavailable',
      rack: 'unavailable',
      machine: 'available',
      cable: 'available',
      bench: 'available',
      bodyweight: 'available',
      kettlebell: 'unavailable',
      cardio: 'unavailable',
    },
  },
];

/** Matches a gym name against the known chains. */
export function matchChain(name: string, brand?: string | null): ChainProfile | null {
  const haystack = `${name} ${brand ?? ''}`.toLowerCase();
  return GYM_CHAINS.find((chain) => chain.match.some((fragment) => haystack.includes(fragment))) ?? null;
}

/** An independent gym: assume nothing, ask the user. */
export const UNKNOWN_EQUIPMENT: Partial<Record<EquipmentId, EquipmentAvailability>> = {
  barbell: 'unsure',
  dumbbell: 'unsure',
  machine: 'unsure',
  cable: 'unsure',
  bench: 'unsure',
  rack: 'unsure',
  bodyweight: 'available',
  kettlebell: 'unsure',
  band: 'unsure',
  cardio: 'unsure',
};
