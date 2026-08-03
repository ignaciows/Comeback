import type { ISODate } from '@/domain/types';
import { round } from '@/utils/math';
import { requiredSessionsPerWeek } from './commitments';
import type { RouteSimulation } from './routes';

/**
 * Qué pasa si haces esto, con fechas, y qué cuesta.
 *
 * Las rutas se simulaban semana a semana y de todo eso sólo se enseñaba el
 * final. Pero nadie elige un plan por dónde termina: lo elige por si aguanta
 * el camino. «Ocho kilos de músculo en dos años» es una cifra que no se puede
 * sentir; «para marzo pesas 82 y estás igual de definido, para septiembre 86»
 * sí, porque marzo llega.
 *
 * Así que cada ruta se cuenta en tres o cuatro paradas con fecha, y al lado
 * lo que hay que poner: los días de gimnasio a la semana. Sin eso el
 * comparador es una lista de promesas, y la que más promete gana siempre.
 *
 * Y hay un techo. El músculo que queda por construir no es infinito ni
 * constante: cuanto más llevas entrenado, menos queda por ganar al año, y una
 * barra que enseña eso es lo que evita que alguien se compare con el ritmo de
 * su primer año para siempre.
 */

export type Milestone = {
  date: ISODate;
  week: number;
  /** «3 meses», «1 año». Cómo se dice la distancia, no la fecha. */
  away: string;
  weightKg: number;
  bodyFatPercent: number | null;
  /** Músculo acumulado desde hoy hasta esta fecha. */
  muscleKg: number;
};

export type RouteOutlook = {
  routeId: string;
  routeName: string;
  milestones: Milestone[];
  /** Total de músculo al final de la ruta. */
  muscleKg: number;
  fatKg: number;
  totalWeeks: number;
  /** Días de gimnasio a la semana que la ruta necesita. */
  sessionsPerWeek: number;
  /** Sesiones que hay que hacer en total. El precio, en sesiones. */
  totalSessions: number;
  /** Músculo por cada cien sesiones: lo que rinde cada visita al gimnasio. */
  musclePerHundredSessions: number;
  endBodyFatPercent: number | null;
  peakBodyFatPercent: number | null;
};

/** Cómo se dice una distancia en semanas sin decir un número de semanas. */
function distance(weeks: number): string {
  if (weeks < 8) return `${weeks} semanas`;
  const months = Math.round(weeks / 4.345);
  if (months < 12) return `${months} meses`;
  const years = weeks / 52;
  if (Math.abs(years - Math.round(years)) < 0.15) {
    const whole = Math.round(years);
    return whole === 1 ? '1 año' : `${whole} años`;
  }
  return `${months} meses`;
}

/**
 * Las paradas que vale la pena enseñar de una ruta.
 *
 * Tres meses, seis meses, un año y el final — las que existan dentro de la
 * ruta. Son las distancias en las que la gente ya piensa: un verano, un
 * invierno. Poner una parada cada mes sería más preciso y menos útil, porque
 * doce filas no se comparan, se hojean.
 */
const STOPS_WEEKS = [13, 26, 52];

export function routeOutlook(simulation: RouteSimulation, objective: 'build' | 'lean' | 'recomp'): RouteOutlook {
  const { points, totalWeeks } = simulation;

  const at = (week: number): Milestone | null => {
    const point = points.find((entry) => entry.week === week);
    if (!point) return null;
    const start = points[0];
    return {
      date: point.date,
      week,
      away: distance(week),
      weightKg: point.weightKg,
      bodyFatPercent: point.bodyFatPercent,
      // Músculo desde hoy, no masa magra total: la cifra que importa es lo
      // que has añadido, no lo que ya tenías.
      muscleKg: round(Math.max(0, point.leanKg - start.leanKg), 1),
    };
  };

  const milestones = [...STOPS_WEEKS.filter((week) => week < totalWeeks), totalWeeks]
    .map(at)
    .filter((stop): stop is Milestone => stop !== null);

  const sessionsPerWeek = requiredSessionsPerWeek(objective, 'steady');
  const totalSessions = Math.round((totalWeeks * sessionsPerWeek) / 1);

  return {
    routeId: simulation.route.id,
    routeName: simulation.route.name,
    milestones,
    muscleKg: simulation.muscleGainKg,
    fatKg: simulation.fatChangeKg,
    totalWeeks,
    sessionsPerWeek,
    totalSessions,
    // Lo que rinde cada sesión. Dos rutas que dan el mismo músculo no cuestan
    // lo mismo si una pide el doble de gimnasio, y sin esto no se nota.
    musclePerHundredSessions: totalSessions > 0 ? round((simulation.muscleGainKg / totalSessions) * 100, 2) : 0,
    endBodyFatPercent: simulation.endBodyFatPercent,
    peakBodyFatPercent: simulation.peakBodyFatPercent,
  };
}

export type OutlookComparison = {
  outlooks: RouteOutlook[];
  /** La que más músculo da al final. */
  mostMuscle: RouteOutlook | null;
  /** La que menos grasa acumula por el camino. */
  leanest: RouteOutlook | null;
  /** La que más rinde por sesión de gimnasio. */
  bestValue: RouteOutlook | null;
  /** La más corta que sigue dando músculo de verdad. */
  quickest: RouteOutlook | null;
};

/**
 * Las rutas, comparadas por lo que cada una hace mejor.
 *
 * Deliberadamente no hay una «ganadora». No existe: la que más músculo da es
 * casi siempre la más larga y la que más grasa acumula, y elegir por ti sería
 * esconder ese intercambio en lugar de enseñarlo. Cada categoría nombra un
 * ganador distinto, y esa discrepancia es la información.
 */
export function compareRoutes(outlooks: RouteOutlook[]): OutlookComparison {
  if (outlooks.length === 0) {
    return { outlooks, mostMuscle: null, leanest: null, bestValue: null, quickest: null };
  }

  const best = <T>(list: RouteOutlook[], score: (entry: RouteOutlook) => number) =>
    list.reduce((winner, entry) => (score(entry) > score(winner) ? entry : winner));

  // «Da músculo de verdad» = al menos la mitad de lo que da la mejor. Sin ese
  // filtro la más rápida es siempre la que no construye nada.
  const topMuscle = Math.max(...outlooks.map((entry) => entry.muscleKg));
  const worthwhile = outlooks.filter((entry) => entry.muscleKg >= topMuscle * 0.5);

  return {
    outlooks,
    mostMuscle: best(outlooks, (entry) => entry.muscleKg),
    leanest: best(outlooks, (entry) => -(entry.peakBodyFatPercent ?? 99)),
    bestValue: best(outlooks, (entry) => entry.musclePerHundredSessions),
    quickest: worthwhile.length > 0 ? best(worthwhile, (entry) => -entry.totalWeeks) : null,
  };
}

/**
 * Cuánto músculo queda por construir, como fracción de lo que queda de techo.
 *
 * El potencial natural no se agota, se frena: cada año que entrenas, el
 * siguiente da menos. La barra mide el año que viene contra el primer año de
 * un principiante, que es el ritmo con el que todo el mundo se compara y con
 * el que nadie debería seguir comparándose a los cinco años.
 */
export function ceilingProgress(input: {
  /** Kilos de músculo ya construidos desde que empezaste a entrenar. */
  builtKg: number;
  /** Lo que este plan añade encima. */
  planKg: number;
  /** Techo de por vida, estimado desde la estructura. */
  lifetimeKg: number;
}): { builtShare: number; planShare: number; remainingKg: number } {
  const ceiling = Math.max(1, input.lifetimeKg);
  const built = Math.min(input.builtKg, ceiling);
  const plan = Math.min(input.planKg, ceiling - built);

  return {
    builtShare: round(built / ceiling, 3),
    planShare: round(plan / ceiling, 3),
    remainingKg: round(Math.max(0, ceiling - built - plan), 1),
  };
}
