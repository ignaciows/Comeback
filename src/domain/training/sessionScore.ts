import type { WorkoutSession } from '@/domain/types';

/**
 * Lo que llevas hecho de la sesión, contado como se vive.
 *
 * La barra de arriba contaba series y ya está, así que saltarse un ejercicio
 * la dejaba clavada para siempre: el número que faltaba nunca iba a llegar, y
 * una barra que no puede llenarse deja de mirarse. Pero saltarse un ejercicio
 * porque no te quedaba nada no es lo mismo que abandonar a media sesión, y la
 * pantalla tiene que saber decir la diferencia.
 *
 * Así que hay dos denominadores. Lo que planeaste al empezar, que no cambia y
 * es contra lo que se mide el día. Y lo que decidiste hacer, que baja cuando
 * te saltas algo — y contra ese sí se puede terminar al cien por cien.
 *
 * De ahí sale lo que se enseña: «12 de 14 series · 1 saltado». No es una
 * disculpa ni un reproche, es lo que pasó.
 */

export type SessionScore = {
  /** Series de trabajo hechas. Nunca cuenta calentamiento. */
  setsDone: number;
  /** Series que quedan en los ejercicios que sí vas a hacer. */
  setsCommitted: number;
  /** Series que había cuando empezaste, saltadas incluidas. */
  setsPlanned: number;
  exercisesDone: number;
  exercisesCommitted: number;
  exercisesSkipped: number;
  /** 0–1 contra lo que decidiste hacer. Esta sí llega a 1. */
  progress: number;
  /** 0–1 contra el plan entero. Ésta es la que se queda corta al saltar. */
  ofPlanned: number;
  /** Series por ejercicio, en orden, para dibujar la rejilla. */
  blocks: ExerciseBlock[];
};

export type ExerciseBlock = {
  id: string;
  exerciseId: string;
  name: string;
  state: 'done' | 'current' | 'ahead' | 'skipped';
  setsDone: number;
  setsPlanned: number;
  /** Una casilla por serie: la rejilla que se va llenando. */
  cells: ('done' | 'todo' | 'skipped')[];
};

const working = (sets: WorkoutSession['exercises'][number]['sets']) => sets.filter((set) => !set.warmup);

export function sessionScore(session: WorkoutSession, exerciseName: (id: string) => string): SessionScore {
  let setsDone = 0;
  let setsCommitted = 0;
  let setsPlanned = 0;
  let exercisesDone = 0;
  let exercisesCommitted = 0;
  let exercisesSkipped = 0;
  let currentTaken = false;

  const blocks: ExerciseBlock[] = session.exercises.map((exercise) => {
    const sets = working(exercise.sets);
    const done = sets.filter((set) => set.completed).length;

    setsPlanned += sets.length;
    if (exercise.skipped) {
      exercisesSkipped += 1;
      // Las series hechas antes de saltarlo siguen contando: las hiciste.
      setsDone += done;
      return {
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        name: exerciseName(exercise.exerciseId),
        state: 'skipped' as const,
        setsDone: done,
        setsPlanned: sets.length,
        cells: sets.map((set) => (set.completed ? ('done' as const) : ('skipped' as const))),
      };
    }

    setsDone += done;
    setsCommitted += sets.length;
    exercisesCommitted += 1;

    let state: ExerciseBlock['state'];
    if (sets.length > 0 && done >= sets.length) {
      state = 'done';
      exercisesDone += 1;
    } else if (!currentTaken) {
      state = 'current';
      currentTaken = true;
    } else {
      state = 'ahead';
    }

    return {
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      name: exerciseName(exercise.exerciseId),
      state,
      setsDone: done,
      setsPlanned: sets.length,
      cells: sets.map((set) => (set.completed ? ('done' as const) : ('todo' as const))),
    };
  });

  return {
    setsDone,
    setsCommitted,
    setsPlanned,
    exercisesDone,
    exercisesCommitted,
    exercisesSkipped,
    progress: setsCommitted > 0 ? Math.min(1, setsDone / setsCommitted) : 0,
    ofPlanned: setsPlanned > 0 ? Math.min(1, setsDone / setsPlanned) : 0,
    blocks,
  };
}

/**
 * La frase de la barra. Lo que hiciste primero, lo que soltaste después.
 *
 * Nombrar lo saltado no es un reproche: no decirlo sería peor, porque
 * entonces el total no cuadra y la persona se queda pensando qué falló.
 */
export function scoreLine(score: SessionScore): string {
  if (score.setsPlanned === 0) return 'Nothing laid out yet';

  const sets = `${score.setsDone} of ${score.setsCommitted} sets`;
  if (score.exercisesSkipped === 0) return sets;
  return `${sets} · ${score.exercisesSkipped} skipped`;
}

/** Lo que se dice al terminar, que depende de si se terminó entero o no. */
export function finishLine(score: SessionScore): string {
  if (score.setsDone === 0) return 'Nothing logged yet.';
  if (score.exercisesSkipped === 0 && score.progress >= 1) return 'Whole session, start to finish.';
  if (score.progress >= 1) {
    // Terminó lo que se propuso hacer. Eso es acabar, aunque el plan
    // original fuera más largo — y decirlo así es la diferencia entre
    // salir del gimnasio habiendo logrado algo o habiendo fallado.
    return `Finished what you committed to — ${score.setsDone} sets.`;
  }
  return `${score.setsDone} sets in the bank.`;
}
