import type { MuscleGroup } from '@/domain/types';

/**
 * What nobody tells you before you walk into a gym.
 *
 * The complaint this answers is the honest one: people press buttons in a
 * training app without knowing what any of it is for. Not "how do I use this
 * screen" — *why does a set matter*, *what does protein actually do*, *why is
 * the app telling me to rest*.
 *
 * Rules the content follows, because a lesson that reads like a textbook does
 * not get read:
 *
 *  · **One idea per lesson.** If it needs two, it is two lessons.
 *  · **Under twenty words a card.** The graphic carries the weight.
 *  · **Every claim traceable.** Each lesson names its source, and the claims
 *    are the same ones the plan is built from — `trainingPrinciples.ts` is the
 *    shared spine, so the app cannot teach one thing and do another.
 *  · **No scolding, no hype.** Nobody learns from being told they are behind.
 *
 * The check at the end of each lesson is not a quiz for marks. It is there
 * because answering a question is what makes the idea stick, and because
 * getting it wrong is the cheapest way to find out you had it backwards.
 */

export type LessonCard = {
  /** The one line. Short enough to read while walking. */
  text: string;
  /** Optional aside: the number, the caveat, the thing people get wrong. */
  note?: string;
};

export type LessonCheck = {
  question: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  /** Shown after answering, whichever way it went. */
  because: string;
};

export type Lesson = {
  id: string;
  title: string;
  /** The single sentence someone should walk away with. */
  takeaway: string;
  /** Key into `LESSON_ART`, or null for a lesson drawn from live data. */
  art: string | null;
  cards: LessonCard[];
  check: LessonCheck;
  source: string;
  /** Muscles to highlight on the body, when the lesson is about anatomy. */
  muscles?: MuscleGroup[];
};

export type Track = {
  id: string;
  title: string;
  /** Why this track exists, in one line. */
  subtitle: string;
  lessons: Lesson[];
};

export const TRACKS: Track[] = [
  {
    id: 'muscle',
    title: 'How muscle grows',
    subtitle: 'The part that happens after you leave',
    lessons: [
      {
        id: 'tension',
        title: 'Muscle needs a reason',
        takeaway: 'Muscle grows when a hard effort tells it that its current size was not enough.',
        art: 'fibres',
        cards: [
          { text: 'A hard set is a message: this was nearly too much.' },
          { text: 'The body answers by building slightly more than it had.' },
          {
            text: 'Light, easy sets send no message.',
            note: 'Which is why "I went to the gym" and "I trained" are different sentences.',
          },
        ],
        check: {
          question: 'What makes a set count?',
          options: ['Sweating a lot', 'Taking it close to hard', 'Doing it fast', 'Feeling sore after'],
          answer: 1,
          because:
            'Effort is the signal. Sweat, speed and soreness are side effects that can all happen without it.',
        },
        source: 'Schoenfeld (2010) on mechanical tension',
      },
      {
        id: 'dose',
        title: 'Sets are the dose',
        takeaway: 'Around ten to twenty hard sets per muscle per week is the useful range.',
        art: 'dose',
        cards: [
          { text: 'Below about ten sets a week, progress is slower than it needs to be.' },
          { text: 'Above about twenty, the extra fatigue usually costs more than it adds.' },
          {
            text: 'More is not better. Enough is better.',
            note: 'Your plan already spreads each muscle across that band.',
          },
        ],
        check: {
          question: 'You are doing 30 hard sets of chest a week. What is the likely result?',
          options: ['Twice the growth', 'The same growth, more fatigue', 'Nothing at all', 'Faster fat loss'],
          answer: 1,
          because: 'The response flattens off, but the recovery cost keeps climbing.',
        },
        source: 'Schoenfeld, Ogborn & Krieger (2017); Baz-Valle et al. (2022)',
      },
      {
        id: 'recovery',
        title: 'It grows while you rest',
        takeaway: 'Training is the request. Sleep and food are when it gets built.',
        art: 'recovery',
        cards: [
          { text: 'The session breaks things down. The days after put them back, bigger.' },
          { text: 'Short sleep makes the same session produce less.' },
          {
            text: 'A rest day is part of the plan, not a gap in it.',
            note: 'This is why the app sometimes tells you not to train.',
          },
        ],
        check: {
          question: 'You slept four hours. Best move?',
          options: [
            'Train harder to make up for it',
            'Train, but expect less and take it easier',
            'Skip the gym forever',
            'Double the coffee and go heavy',
          ],
          answer: 1,
          because:
            'Restricted sleep lowers strength and work capacity. Showing up still counts; pretending it changes nothing does not.',
        },
        source: 'Nedeltcheva et al. (2010); Craven et al. (2022)',
      },
    ],
  },
  {
    id: 'food',
    title: 'How food works',
    subtitle: 'Two dials, and only two',
    lessons: [
      {
        id: 'balance',
        title: 'Energy decides the direction',
        takeaway: 'Eat more than you spend and you gain weight. Less, and you lose it.',
        art: 'balance',
        cards: [
          { text: 'Which direction your weight moves is decided by energy, not by any single food.' },
          { text: 'No food is banned. Some just make it much easier to overshoot.' },
          {
            text: 'The scale moves for many reasons. Only the trend means anything.',
            note: 'Water, salt and yesterday’s dinner all move it by a kilo or two.',
          },
        ],
        check: {
          question: 'You ate the same amount but swapped rice for quinoa. Weight will…',
          options: ['Go down', 'Go up', 'Do roughly the same as before', 'Stay exactly frozen'],
          answer: 2,
          because: 'Swapping one food for another of similar energy does not change the direction.',
        },
        source: 'Hall & Guo (2017) energy balance review',
      },
      {
        id: 'protein',
        title: 'Protein is the material',
        takeaway: 'Energy sets the direction; protein decides how much of it is muscle.',
        art: 'protein',
        cards: [
          { text: 'Training asks for muscle. Protein is what it is built out of.' },
          {
            text: 'Roughly 1.6 to 2.2 grams per kilo of body weight covers it.',
            note: 'More than that has not been shown to add anything.',
          },
          { text: 'Eating in a deficit? Protein is what protects the muscle you already have.' },
        ],
        check: {
          question: 'You weigh 80 kg. Roughly how much protein a day?',
          options: ['40 g', '130–175 g', '400 g', 'As much as possible'],
          answer: 1,
          because: '1.6–2.2 g per kg. Past that, the extra is just food.',
        },
        source: 'Morton et al. (2018) meta-analysis; Helms et al. (2014)',
      },
      {
        id: 'rate',
        title: 'It cannot be rushed',
        takeaway: 'Muscle has a speed limit. Eating more does not raise it.',
        art: null,
        cards: [
          { text: 'A big surplus does not build muscle faster. It adds fat alongside it.' },
          { text: 'Losing faster than about one percent of body weight a week starts costing muscle.' },
          {
            text: 'The ceiling is set by how long you have trained, not by appetite.',
            note: 'Coming back after a break is the exception: that regains quickly.',
          },
        ],
        check: {
          question: 'Someone promises 10 kg of muscle in a month. That is…',
          options: ['Possible with enough food', 'Possible with the right supplement', 'Not physiologically possible', 'Normal for beginners'],
          answer: 2,
          because:
            'Even a well-fed beginner tops out near one to one and a half percent of body weight a month.',
        },
        source: 'Garthe et al. (2011); Aragon & Schoenfeld rate model',
      },
    ],
  },
  {
    id: 'training',
    title: 'How to train',
    subtitle: 'What actually moves the needle',
    lessons: [
      {
        id: 'effort',
        title: 'Effort beats the number',
        takeaway: 'Stop a rep or two short of failure. That is the sweet spot.',
        art: 'effort',
        cards: [
          { text: 'A set stopped two reps short does nearly everything a set to failure does.' },
          { text: 'It costs far less fatigue, so the next set and the next session are better.' },
          {
            text: 'The weight on the bar is a means. The effort is the point.',
            note: 'This is what "reps in reserve" means when the app asks.',
          },
        ],
        check: {
          question: 'You could have done 3 more reps. Was that set useful?',
          options: ['No, wasted', 'Yes, but a bit light', 'It was perfect', 'Only if you felt sore'],
          answer: 1,
          because: 'Three in reserve is on the easy edge. Two is the target; four and up is warming up.',
        },
        source: 'Refalo et al. (2023); Grgic et al. (2022); Helms RIR scale',
      },
      {
        id: 'overload',
        title: 'Add a little, often',
        takeaway: 'Earn the reps first, then add the weight.',
        art: 'overload',
        cards: [
          { text: 'Work up the rep range at the same weight until you hit the top of it.' },
          { text: 'Then add the smallest increment the gym has and start again.' },
          {
            text: 'Slow on purpose. This is the rule least likely to break you.',
            note: 'The app does this arithmetic for you between sets.',
          },
        ],
        check: {
          question: 'Prescription is 6–10 reps. You got 10 on every set. Next session?',
          options: ['Same weight, chase 12', 'Add weight, back to 6', 'Add three exercises', 'Take a week off'],
          answer: 1,
          because: 'Top of the range on every set is the signal that the weight has been earned.',
        },
        source: 'Double progression; ACSM position stand (2009)',
      },
      {
        id: 'frequency',
        title: 'Twice beats once',
        takeaway: 'Split a muscle’s weekly work across two sessions rather than one.',
        art: null,
        cards: [
          { text: 'Same total sets, spread over two days, works at least as well.' },
          { text: 'And each session is far easier to recover from.' },
          {
            text: 'Which is why your plan hits everything about twice a week.',
            note: 'Not because more days is more virtuous.',
          },
        ],
        check: {
          question: 'Sixteen sets of legs a week. Better as…',
          options: ['All 16 on one day', 'Eight and eight', 'Two a day, every day', 'It makes no difference at all'],
          answer: 1,
          because: 'Splitting it keeps quality up in both sessions and the recovery cost down.',
        },
        source: 'Schoenfeld, Ogborn & Krieger (2016)',
      },
    ],
  },
  {
    id: 'body',
    title: 'How the body changes',
    subtitle: 'Why the mirror is a bad instrument',
    lessons: [
      {
        id: 'two_dials',
        title: 'Muscle and fat are separate',
        takeaway: 'They move independently. One number on a scale cannot tell them apart.',
        art: null,
        cards: [
          { text: 'Muscle takes up less room than fat for the same weight.' },
          { text: 'So you can look different at exactly the same body weight.' },
          {
            text: 'A flat scale during a good month is often muscle up, fat down.',
            note: 'This is why the app tracks the two separately instead of one number.',
          },
        ],
        check: {
          question: 'Same weight for six weeks, clothes fit better. What happened?',
          options: ['Nothing', 'Muscle up and fat down', 'You measured wrong', 'You lost water'],
          answer: 1,
          because: 'Weight is a sum. It stays still while the two things inside it swap places.',
        },
        source: 'Standard body-composition practice',
      },
      {
        id: 'memory',
        title: 'Coming back is faster',
        takeaway: 'Regaining what you once had is much quicker than building it the first time.',
        art: null,
        cards: [
          { text: 'Muscle you built before leaves behind machinery that does not disappear.' },
          { text: 'Strength comes back in weeks, not in the months it first took.' },
          {
            text: 'A long break is a setback, not a reset.',
            note: 'The app measures how much of your old level you have back.',
          },
        ],
        check: {
          question: 'Six months off after two years training. Getting back to your old lifts takes…',
          options: ['Another two years', 'Far less than two years', 'Forever', 'One session'],
          answer: 1,
          because: 'The nuclei added by earlier training persist, so the second climb is much faster.',
        },
        source: 'Snijders et al. (2020); Bosquet et al. (2013)',
      },
      {
        id: 'trend',
        title: 'Trust the trend',
        takeaway: 'One weigh-in is noise. Two weeks of weigh-ins is information.',
        art: null,
        cards: [
          { text: 'Day-to-day weight swings a kilo or more on water and food alone.' },
          { text: 'Reacting to a single reading means reacting to nothing.' },
          {
            text: 'The app waits for enough data before it changes your plan.',
            note: 'That is not slowness. It is refusing to guess.',
          },
        ],
        check: {
          question: 'Up 1.2 kg since yesterday. Correct response?',
          options: ['Cut calories now', 'Add an extra session', 'Log it and carry on', 'Start over'],
          answer: 2,
          because: 'A one-day jump is almost never fat. Give the trend two weeks to say something.',
        },
        source: 'Trexler et al. (2014) on measurement variability',
      },
    ],
  },
];

/** Every lesson, flattened, in the order they are meant to be met. */
export const ALL_LESSONS: { track: Track; lesson: Lesson }[] = TRACKS.flatMap((track) =>
  track.lessons.map((lesson) => ({ track, lesson })),
);

export function findLesson(id: string): { track: Track; lesson: Lesson } | null {
  return ALL_LESSONS.find((entry) => entry.lesson.id === id) ?? null;
}

/** The lesson after this one, across track boundaries. Null at the end. */
export function nextLesson(id: string): { track: Track; lesson: Lesson } | null {
  const index = ALL_LESSONS.findIndex((entry) => entry.lesson.id === id);
  if (index < 0) return null;
  return ALL_LESSONS[index + 1] ?? null;
}
