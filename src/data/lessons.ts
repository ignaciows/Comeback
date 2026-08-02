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
 *
 * Those rules used to hold only while somebody remembered them. `learning.test`
 * asserts them now, so a lesson added in a hurry fails the suite by name
 * rather than quietly lowering the bar for the ones after it.
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
      {
        id: 'reps',
        title: 'Almost any rep range works',
        takeaway: 'Five reps or thirty, taken close to hard, build similar amounts of muscle.',
        art: null,
        cards: [
          { text: 'There is no magic number. Heavy triples and light twenties both grow muscle.' },
          {
            text: 'Middle ranges are popular because they are practical, not because they are special.',
            note: 'Six to fifteen is enough load to matter and few enough reps to stay honest.',
          },
          { text: 'Very heavy builds more strength. Very light burns more and is harder to push.' },
        ],
        check: {
          question: 'Twenty reps with a light weight, stopped near failure. For muscle that is…',
          options: ['Useless, too light', 'Roughly as good as a heavy set', 'Better than anything heavy', 'Only good for endurance'],
          answer: 1,
          because: 'Load is the setting; effort is the signal. Taken close to hard, the ranges land in much the same place.',
        },
        source: 'Schoenfeld et al. (2017) load meta-analysis; Lasevicius et al. (2018)',
      },
      {
        id: 'soreness',
        title: 'Soreness is not the scoreboard',
        takeaway: 'How sore you are tells you what is unfamiliar, not what is working.',
        art: null,
        cards: [
          { text: 'Soreness spikes when a movement is new, and fades as you repeat it.' },
          {
            text: 'The lifts that grow you most are the ones you have done for months — the ones that stop hurting.',
            note: 'Chasing soreness means changing exercises constantly, which is the opposite of progress.',
          },
          { text: 'Not sore after a good session is normal. It is not a wasted session.' },
        ],
        check: {
          question: 'Squats stopped making you sore. That means…',
          options: ['They have stopped working', 'Your body has adapted to the movement', 'You are not trying', 'You need a new exercise'],
          answer: 1,
          because: 'Adaptation is the goal. Whether the weight is going up tells you if it works — soreness does not.',
        },
        source: 'Schoenfeld & Contreras (2013) on DOMS as an indicator',
      },
    ],
  },
  {
    id: 'food',
    title: 'How food works',
    subtitle: 'What each macro is actually for',
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
        id: 'carbs',
        title: 'Carbohydrate is the fuel',
        takeaway: 'Carbs are what hard sets run on. Cut them low and the training gets worse.',
        art: null,
        cards: [
          { text: 'Muscles store carbohydrate as glycogen. Hard sets spend it fast.' },
          {
            text: 'Run low and the last reps of every set disappear — the ones that were doing the work.',
            note: 'Not dangerous. Just quietly less training than you think you are doing.',
          },
          { text: 'Carbs are not fattening. Eating more energy than you spend is.' },
        ],
        check: {
          question: 'You cut carbs hard and your lifts dropped. Most likely reason?',
          options: ['You lost muscle overnight', 'Less glycogen, so less work per set', 'Carbs are addictive', 'You need more protein'],
          answer: 1,
          because: 'Glycogen is the fuel for repeated hard efforts. Empty the tank and the volume you can hold goes down with it.',
        },
        source: 'Vigh-Larsen et al. (2021) on muscle glycogen; Burke et al. (2011)',
      },
      {
        id: 'fat',
        title: 'Fat is the maintenance budget',
        takeaway: 'Fat runs your hormones and absorbs vitamins. There is a floor you should not go under.',
        art: null,
        cards: [
          { text: 'Some vitamins only travel in fat. Without it they do not get absorbed.' },
          {
            text: 'Keep it above roughly 0.5 grams per kilo of body weight.',
            note: 'Below that, in very lean people, hormones start to drift.',
          },
          { text: 'Past that floor, fat and carbs are interchangeable. Spend the rest where you prefer.' },
        ],
        check: {
          question: 'You weigh 80 kg. The sensible floor for daily fat is around…',
          options: ['0 g — fat makes you fat', '40 g', '200 g', 'There is no floor'],
          answer: 1,
          because: 'About 0.5 g per kg. Under it you are trading hormones and vitamin absorption for nothing.',
        },
        source: 'Helms et al. (2014); Whittaker & Wheeler (2021) on dietary fat and testosterone',
      },
      {
        id: 'timing',
        title: 'When you eat barely matters',
        takeaway: 'Hitting your day’s total beats hitting any particular hour.',
        art: null,
        cards: [
          { text: 'The "anabolic window" after training is hours wide, not thirty minutes.' },
          {
            text: 'Spreading protein across three or four meals is a small edge, not a rule.',
            note: 'Eat on a schedule you can actually keep. That edge is bigger than any timing trick.',
          },
          { text: 'Eating late does not make food count differently.' },
        ],
        check: {
          question: 'You trained at 7 pm and ate at 9 pm. You…',
          options: ['Missed the window, wasted the session', 'Are fine', 'Should have eaten mid-set', 'Lost muscle'],
          answer: 1,
          because: 'The window is wide. Two hours later is well inside it, and the day’s total is what was doing the work.',
        },
        source: 'Schoenfeld, Aragon & Krieger (2013); Aragon & Schoenfeld (2013)',
      },
      {
        id: 'steps',
        title: 'Most of what you burn is not training',
        takeaway: 'Walking around all day burns far more than an hour in the gym.',
        art: null,
        cards: [
          { text: 'Training costs a few hundred calories. Daily movement costs several times that.' },
          {
            text: 'When you eat less, the body quietly moves less — and that gap is where a diet stalls.',
            note: 'Fewer fidgets, slower walking, more sitting. Nobody notices themselves doing it.',
          },
          { text: 'Which is why a step count is worth watching, and not because steps are exercise.' },
        ],
        check: {
          question: 'Three weeks into a deficit the scale stops. You are still logging honestly. Likely?',
          options: ['Metabolism broken', 'You are moving less than you were', 'Muscle turned to fat', 'The scale is wrong'],
          answer: 1,
          because: 'Non-exercise movement falls as you diet. It is the usual explanation for a stall that logging cannot see.',
        },
        source: 'Levine (2004) on non-exercise activity thermogenesis',
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
      {
        id: 'range',
        title: 'Go all the way down',
        takeaway: 'A full range of motion builds more muscle than a heavier half rep.',
        art: null,
        cards: [
          { text: 'The stretched part of a rep is where most of the growth signal lives.' },
          {
            text: 'Cutting the bottom to lift more trades the useful half for a bigger number.',
            note: 'Half squats with double the weight are a different exercise, not a better one.',
          },
          { text: 'If the full range needs less weight, use less weight.' },
        ],
        check: {
          question: 'Full-range curls with 12 kg, or half-range with 20 kg. For muscle?',
          options: ['The 20 kg, obviously', 'The full range with 12 kg', 'Identical', 'Neither works'],
          answer: 1,
          because: 'Long-length reps out-build heavier partials. The load on the bar is not the thing being measured.',
        },
        source: 'Schoenfeld & Grgic (2020); Pedrosa et al. (2022)',
      },
      {
        id: 'rest',
        title: 'Rest longer than feels productive',
        takeaway: 'Two to three minutes between hard sets. Rushing costs you reps you needed.',
        art: null,
        cards: [
          { text: 'Short rests feel harder and produce less. The next set collapses.' },
          {
            text: 'Two to three minutes on the big lifts; a minute or so on small isolation work.',
            note: 'Sitting still between sets is not wasted time — it is what buys the next set.',
          },
          { text: 'Out of breath is fine. Rest until the muscle is ready, not until the lungs are.' },
        ],
        check: {
          question: 'You cut rest from 3 minutes to 45 seconds. Over weeks this…',
          options: ['Builds more muscle', 'Builds less, because total reps drop', 'Makes no difference', 'Only affects cardio'],
          answer: 1,
          because: 'Shorter rests cut the reps you complete at a given weight, and it is that work which drives growth.',
        },
        source: 'Schoenfeld et al. (2016) rest-interval trial; Grgic et al. (2018)',
      },
      {
        id: 'warmup',
        title: 'Warm up the lift, not the body',
        takeaway: 'A few lighter sets of the exercise you are about to do. That is the whole method.',
        art: null,
        cards: [
          { text: 'Ramp up: empty bar, then a light set, then a moderate one, then work.' },
          {
            text: 'Long static stretching before lifting makes you temporarily weaker.',
            note: 'Save it for after, or for a separate day, if you want it at all.',
          },
          { text: 'Isolation work at the end usually needs no warm-up. The big lift already did it.' },
        ],
        check: {
          question: 'Best warm-up before heavy squats?',
          options: ['Ten minutes of hamstring stretches', 'Two or three lighter squat sets', 'Nothing, save energy', 'A long run'],
          answer: 1,
          because: 'Rehearsing the movement under rising load prepares it. Prolonged static stretching briefly reduces force.',
        },
        source: 'Fradkin et al. (2010); Simic, Sarabon & Markovic (2013)',
      },
      {
        id: 'cardio',
        title: 'Cardio does not kill your gains',
        takeaway: 'It interferes only when there is a lot of it, hard, on the same muscles, right before lifting.',
        art: null,
        cards: [
          { text: 'Moderate cardio alongside lifting costs muscle almost nothing.' },
          {
            text: 'The clash is specific: long, hard running blunts leg growth more than cycling does.',
            note: 'Separate them by a few hours, or put them on different days, and most of it disappears.',
          },
          { text: 'Your heart is not optional equipment. Some cardio is worth a small cost anyway.' },
        ],
        check: {
          question: 'You want cardio without hurting leg growth. Best choice?',
          options: ['Long hard runs before legs day', 'Cycling or walking, on a different day', 'No cardio ever', 'Sprints right after squats'],
          answer: 1,
          because: 'Interference scales with how much, how hard, how similar the muscles, and how close in time.',
        },
        source: 'Wilson et al. (2012) concurrent-training meta-analysis; Schumann et al. (2022)',
      },
    ],
  },
  {
    id: 'phases',
    title: 'Bulking and cutting',
    subtitle: 'The two words everyone uses and nobody defines',
    lessons: [
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
      {
        id: 'bulk',
        title: 'A bulk is a small surplus, held',
        takeaway: 'Eat slightly more than you spend, for months. That is all the word means.',
        art: null,
        cards: [
          { text: 'Around 10 to 20 percent above what you spend — roughly 0.25 to 0.5 percent of body weight a week.' },
          {
            text: 'Bigger than that does not build muscle faster. It adds fat you will spend months removing.',
            note: 'For an 80 kg person that is about 200 to 400 g a week, not a kilo.',
          },
          { text: 'The "dirty bulk" is not a strategy. It is a longer cut, bought in advance.' },
        ],
        check: {
          question: 'You weigh 80 kg and gained 1.2 kg this week on a bulk. That is…',
          options: ['Perfect', 'Too fast — mostly fat', 'Too slow', 'Impossible'],
          answer: 1,
          because: 'The useful rate is around 200–400 g a week at that body weight. The rest is fat riding along.',
        },
        source: 'Slater et al. (2019); Garthe et al. (2013)',
      },
      {
        id: 'cut',
        title: 'A cut is a small deficit, held',
        takeaway: 'Slow enough to keep your muscle and your training. Not a punishment.',
        art: null,
        cards: [
          { text: 'Aim for around 0.5 to 1 percent of body weight a week. Leaner people should go slower.' },
          {
            text: 'Keep protein high and keep lifting heavy: those are what tell the body to hold on to the muscle.',
            note: 'A cut without lifting mostly removes whatever the body is not using.',
          },
          { text: 'Faster is not braver. It costs muscle, strength and the will to keep going.' },
        ],
        check: {
          question: 'On a cut, which pair protects your muscle best?',
          options: ['Cardio and low carbs', 'High protein and heavy lifting', 'Fasting and supplements', 'Higher reps, lighter weight'],
          answer: 1,
          because: 'Protein supplies the material and heavy training supplies the reason to keep it. Neither is optional.',
        },
        source: 'Garthe et al. (2011); Helms, Aragon & Fitschen (2014)',
      },
      {
        id: 'recomp',
        title: 'Sometimes you can do both',
        takeaway: 'Building muscle while losing fat is real, but only in specific situations.',
        art: null,
        cards: [
          { text: 'It happens reliably in beginners, in people returning after a break, and in people carrying more fat.' },
          {
            text: 'The fat you already have supplies the energy, so a surplus is not needed.',
            note: 'That is why coming back after time off feels almost unfair. Use it.',
          },
          { text: 'For a lean, long-trained lifter it is slow. That is when phases start to be worth it.' },
        ],
        check: {
          question: 'Who is most likely to gain muscle and lose fat at once?',
          options: ['A lean 10-year lifter', 'Someone returning after a year off', 'Nobody, ever', 'Only with drugs'],
          answer: 1,
          because: 'Returning lifters have muscle memory and fat to spend. Both conditions point the same way.',
        },
        source: 'Barakat et al. (2020) body-recomposition review',
      },
      {
        id: 'choose',
        title: 'Which one you should be in',
        takeaway: 'Most people asking the question should eat near maintenance and train.',
        art: null,
        cards: [
          { text: 'Very lean and want to grow? A small surplus.' },
          { text: 'Carrying more fat than you want? A small deficit.' },
          {
            text: 'Anywhere in between, and new or returning? Neither. Eat around maintenance and train hard.',
            note: 'Switching phases every three weeks is how people spend a year going nowhere.',
          },
        ],
        check: {
          question: 'Returning after eight months off, at a weight you are fine with. Best move?',
          options: ['Aggressive bulk', 'Aggressive cut', 'Eat near maintenance and train', 'Alternate weekly'],
          answer: 2,
          because: 'A returning lifter recomps well. A phase would add a cost without buying any extra speed.',
        },
        source: 'Barakat et al. (2020); Helms et al. (2014)',
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
      {
        id: 'spot',
        title: 'You do not choose where fat leaves',
        takeaway: 'Training a muscle does not remove the fat sitting on top of it.',
        art: null,
        cards: [
          { text: 'Sit-ups build the muscle underneath. They do not empty the layer above it.' },
          {
            text: 'Where fat comes off first is set by your genes, and the belly is usually last.',
            note: 'Which is exactly why it feels like nothing is happening for so long.',
          },
          { text: 'The abs arrive when overall body fat falls. There is no shortcut to one area.' },
        ],
        check: {
          question: 'Six weeks of daily ab work, same diet. Your waist…',
          options: ['Shrinks a lot', 'Changes little', 'Grows', 'Only shrinks on one side'],
          answer: 1,
          because: 'Local training does not draw down local fat. Total energy balance is what moves it.',
        },
        source: 'Vispute et al. (2011); Ramírez-Campillo et al. (2013)',
      },
      {
        id: 'plateau',
        title: 'A plateau is usually not the plan',
        takeaway: 'Before changing the programme, check whether you actually ran it.',
        art: null,
        cards: [
          { text: 'Most stalls are missed sessions, short sleep, or sets that stopped being hard.' },
          {
            text: 'Progress also just slows down. A year in, months per kilo is normal, not broken.',
            note: 'The first six months are the fastest you will ever be. Nothing goes wrong after them.',
          },
          { text: 'Change one thing and give it a month. Changing five teaches you nothing.' },
        ],
        check: {
          question: 'Lifts flat for three weeks. First thing to check?',
          options: ['Buy a new programme', 'Whether you trained, slept and ate as planned', 'Add four exercises', 'Take a month off'],
          answer: 1,
          because: 'The plan cannot fail at something it never got to do. Adherence explains most stalls before programming does.',
        },
        source: 'Kraemer & Ratamess (2004) on progression; Helms et al. (2014)',
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
