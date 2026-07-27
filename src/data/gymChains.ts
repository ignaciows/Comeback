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

/** EMS studios: electrodes and a trainer, nothing to load a lift with. */
const EMS_STUDIO: Partial<Record<EquipmentId, EquipmentAvailability>> = {
  barbell: 'unavailable',
  dumbbell: 'unavailable',
  machine: 'unavailable',
  cable: 'unavailable',
  rack: 'unavailable',
  bench: 'unavailable',
  bodyweight: 'available',
  cardio: 'unavailable',
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
    id: 'justfit',
    match: ['just fit', 'justfit'],
    label: 'Just Fit',
    note: 'Cologne chain, most locations in the city. Full free-weight area and machines.',
    equipment: FULL_GYM,
  },
  {
    id: 'nextdoor',
    match: ['next door'],
    label: 'Next Door',
    note: 'Just Fit’s smaller format. Free weights and machines, less floor space.',
    equipment: { ...FULL_GYM, kettlebell: 'unsure' },
  },
  {
    id: 'basicfit',
    match: ['basic-fit', 'basic fit', 'basicfit'],
    label: 'Basic-Fit',
    note: 'Full equipment, cheap, usually open long hours.',
    equipment: FULL_GYM,
  },
  {
    id: 'xtrafit',
    match: ['xtrafit', 'xtra fit'],
    label: 'Xtrafit',
    note: 'Full gym with a proper free-weight section.',
    equipment: FULL_GYM,
  },
  {
    id: 'fitnessloft',
    match: ['fitnessloft', 'fitness loft'],
    label: 'Fitnessloft',
    note: 'Full equipment; free-weight area varies by site.',
    equipment: { ...FULL_GYM, rack: 'unsure' },
  },
  {
    id: 'bodystreet',
    match: ['bodystreet'],
    label: 'Bodystreet',
    note: 'EMS studio — no conventional weights. Not suitable for these routines.',
    equipment: EMS_STUDIO,
  },
  {
    id: 'koerperformen',
    match: ['körperformen', 'koerperformen'],
    label: 'Körperformen',
    note: 'EMS studio — no conventional weights. Not suitable for these routines.',
    equipment: EMS_STUDIO,
  },
  {
    id: 'beat81',
    match: ['beat81', 'beat 81'],
    label: 'Beat81',
    note: 'HIIT classes on bikes and treadmills. No racks or barbells — cardio, not lifting.',
    equipment: {
      barbell: 'unavailable',
      dumbbell: 'available',
      machine: 'unavailable',
      cable: 'unavailable',
      rack: 'unavailable',
      bench: 'unsure',
      bodyweight: 'available',
      kettlebell: 'unsure',
      cardio: 'available',
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
