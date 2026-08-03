import type { Macros } from '@/domain/plan/simulate';
import type { ISODate } from '@/domain/types';

/**
 * Pasarle a MIKUY los macros que este plan pide.
 *
 * Las dos apps son dos apps: no comparten almacenamiento y Salud no sirve de
 * canal, porque HealthKit tiene tipos para lo que *comiste* y ninguno para lo
 * que te *propusiste* comer. Un objetivo no es un dato de salud, es una
 * decisión, y no hay dónde escribirlo.
 *
 * Así que un enlace. Comeback arma la URL con los números, MIKUY los lee al
 * abrirse y pregunta si quiere adoptarlos. Es la única vía que funciona hoy
 * sin código nativo en ninguna de las dos, sin servidor y sin cuenta: nada
 * que configurar, nada que se pueda desincronizar en silencio.
 *
 * Va la fecha de caducidad de la fase, no sólo los números. Un plan de dos
 * años cambia de macros ocho veces, y unos macros sin fecha son unos macros
 * que MIKUY va a seguir usando tres meses después de que dejaran de ser los
 * correctos — que es peor que no haberlos pasado nunca.
 */

export const MIKUY_SCHEME = 'mikuy://plan';

export type MikuyPlanLink = {
  url: string;
  /** Lo que el usuario está a punto de mandar, para poder enseñárselo antes. */
  summary: string;
};

export function mikuyPlanLink(input: {
  macros: Macros;
  /** Cómo se llama la fase, para que MIKUY pueda decir de dónde salieron. */
  phaseLabel: string;
  /** Cuándo dejan de valer estos macros. */
  validUntil: ISODate | null;
}): MikuyPlanLink {
  const params = new URLSearchParams({
    kcal: String(Math.round(input.macros.kcal)),
    protein: String(Math.round(input.macros.proteinG)),
    carbs: String(Math.round(input.macros.carbsG)),
    fat: String(Math.round(input.macros.fatG)),
    phase: input.phaseLabel,
    from: 'comeback',
  });
  if (input.validUntil) params.set('until', input.validUntil);

  return {
    url: `${MIKUY_SCHEME}?${params.toString()}`,
    summary: `${Math.round(input.macros.kcal)} kcal · ${Math.round(input.macros.proteinG)} g proteína · ${Math.round(
      input.macros.carbsG,
    )} g carbos · ${Math.round(input.macros.fatG)} g grasa`,
  };
}

/**
 * Lo que MIKUY tiene que entender del otro lado.
 *
 * Se define aquí, junto a quien lo escribe, para que las dos mitades del
 * contrato no puedan separarse sin que alguien lo note.
 */
export type MikuyPlanPayload = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  phase: string;
  until: ISODate | null;
};

export function parseMikuyPlanLink(url: string): MikuyPlanPayload | null {
  const query = url.split('?')[1];
  if (!query) return null;

  const params = new URLSearchParams(query);
  const num = (key: string) => {
    const raw = params.get(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };

  const kcal = num('kcal');
  const protein = num('protein');
  const carbs = num('carbs');
  const fat = num('fat');

  // Todo o nada. Unos macros a los que les falta la proteína no son unos
  // macros a medias, son un objetivo distinto del que se mandó.
  if (kcal === null || protein === null || carbs === null || fat === null) return null;
  if (kcal === 0) return null;

  return {
    kcal,
    protein,
    carbs,
    fat,
    phase: params.get('phase') ?? 'Plan',
    until: params.get('until'),
  };
}
