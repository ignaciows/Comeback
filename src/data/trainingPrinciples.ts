/**
 * The rules the plans are built from, and where they come from.
 *
 * Comeback does not invent training theory. It applies a small number of
 * well-supported findings and says which one it is applying. This file is the
 * single place those claims live, so the Method screen and the plan builder
 * cannot drift apart.
 */

export type Principle = {
  id: string;
  title: string;
  /** What the app actually does because of this. */
  application: string;
  detail: string;
  source: string;
};

export const TRAINING_PRINCIPLES: Principle[] = [
  {
    id: 'volume',
    title: 'Roughly 10–20 hard sets per muscle per week',
    application: 'Routines are built so each muscle lands in that band across the week.',
    detail:
      'Weekly set volume drives hypertrophy with diminishing and eventually negative returns. Below about 10 sets progress is slower than it needs to be; far above 20 the extra fatigue usually costs more than it adds.',
    source: 'Schoenfeld, Ogborn & Krieger (2017); Baz-Valle et al. (2022)',
  },
  {
    id: 'frequency',
    title: 'Train each muscle about twice a week',
    application: 'Every generated routine hits each major muscle group at least twice per week.',
    detail:
      'With weekly volume held equal, splitting it across two or more sessions is at least as good as one, and easier to recover from per session.',
    source: 'Schoenfeld, Ogborn & Krieger (2016)',
  },
  {
    id: 'proximity',
    title: 'Take working sets close to failure, not to it',
    application: 'Prescribed sets target 1–3 reps in reserve; the session logs RIR so this stays visible.',
    detail:
      'Sets taken within a few reps of failure produce a similar stimulus to failure itself, with meaningfully less fatigue. Training to failure on every set mostly buys fatigue.',
    source: 'Refalo et al. (2023); Grgic et al. (2022)',
  },
  {
    id: 'load',
    title: 'Rep range matters less than effort',
    application: 'Compounds sit in the 5–10 range, accessories in 8–15, and both count the same for volume.',
    detail:
      'Anywhere from about 5 to 30 reps builds similar muscle when sets are taken near failure. Heavier ranges are better for strength; moderate ranges are easier to accumulate volume in.',
    source: 'Schoenfeld et al. (2017), load meta-analysis',
  },
  {
    id: 'rest',
    title: 'Rest 2–3 minutes on compounds',
    application: 'Default rest is 3 minutes on main lifts and 90 seconds on accessories.',
    detail:
      'Short rest reduces the volume you can complete at a given load. Longer rest on multi-joint work produces more growth than one-minute rest.',
    source: 'Schoenfeld et al. (2016), rest interval trial',
  },
  {
    id: 'progression',
    title: 'Add load only when the top of the rep range is clean',
    application: 'Suggested weights hold until you complete every set at the top of its range.',
    detail:
      'Double progression — reps first, then load — keeps technique intact and makes progress measurable instead of guessed.',
    source: 'Standard periodisation practice; ACSM position stand (2009)',
  },
  {
    id: 'autoregulation',
    title: 'Let the last set pick the next weight',
    application: 'In a guided session the suggested load moves one increment when your reps in reserve say it should.',
    detail:
      'Strength varies day to day with sleep, food and stress, so a weight fixed weeks in advance is right only by accident. Rating how many reps were left in the tank turns each set into the input for the next one.',
    source: 'Helms et al. (2016) RIR-based RPE scale; Zourdos et al. (2016)',
  },
  {
    id: 'focus',
    title: 'One cue, and which kind depends on the lift',
    application: 'Compounds get a cue about the effect of the movement; isolation work gets one about the muscle.',
    detail:
      'An external focus — pushing the floor away — produces more force and faster skill learning than thinking about the body part. For single-joint work aimed at growth it reverses: attention on the working muscle produced more arm growth.',
    source: 'Wulf (2013) review; Schoenfeld et al. (2018) attentional focus trial',
  },
  {
    id: 'warmup',
    title: 'Ramp into the first heavy set',
    application: 'Compounds over 30 kg get two or three light sets at 50, 70 and 85 % before the working weight.',
    detail:
      'Rehearsing the pattern under rising load raises muscle temperature and readies the movement without spending the session. Isolation work does not need it.',
    source: 'ACSM position stand (2009); standard warm-up practice',
  },
  {
    id: 'protein',
    title: '1.6–2.2 g of protein per kg of body weight',
    application: 'The protein target is set from your body weight and rises during a cut.',
    detail:
      'Intake around 1.6 g/kg captures most of the benefit for muscle gain, with some further benefit up to about 2.2. In a deficit, higher intake protects lean mass.',
    source: 'Morton et al. (2018) meta-analysis; Helms et al. (2014)',
  },
  {
    id: 'rate',
    title: 'Lose 0.5–1 % of body weight per week, gain 0.25–0.5 %',
    application: 'Every strategy in the plan picker uses a rate from this band, and projections follow it.',
    detail:
      'Faster loss costs lean mass and performance. Faster gain adds fat without adding muscle, because muscle cannot be built past a ceiling set by training age.',
    source: 'Garthe et al. (2011, 2013); Helms et al. (2014); Slater et al. (2019)',
  },
  {
    id: 'ceiling',
    title: 'Muscle gain has a hard rate ceiling',
    application: 'Projections cap muscle gain by training age, so a bigger surplus never promises a faster result.',
    detail:
      'Roughly 1–1.5 % of body weight per month is possible when new to training, 0.5–1 % at intermediate level, and 0.25–0.5 % after that. Returning lifters regain faster than they built it originally.',
    source: 'Aragon & Schoenfeld rate model; Snijders et al. (2020) on muscle memory',
  },
  {
    id: 'sleep',
    title: 'Sleep is a training variable',
    application: 'Sleep and recovery drive the daily recommendation and 15 % of Momentum.',
    detail:
      'Restricted sleep reduces strength and work capacity and shifts weight loss towards lean tissue. It is the cheapest performance intervention there is.',
    source: 'Nedeltcheva et al. (2010); Craven et al. (2022)',
  },
  {
    id: 'consistency',
    title: 'Consistency beats optimisation',
    application: 'A reduced session counts for most of a full one; only skipping costs you.',
    detail:
      'Adherence explains more of the long-run outcome than programme design. A slightly worse plan you actually follow wins.',
    source: 'Consistent finding across long-term adherence trials',
  },
  {
    id: 'detraining',
    title: 'Fitness fades slowly, and comes back faster',
    application: 'The Comeback Progress model measures how much of your previous level you have regained.',
    detail:
      'Strength is largely retained for a few weeks of inactivity and returns quickly on resumption; the nuclei added by previous training persist.',
    source: 'Bosquet et al. (2013); Snijders et al. (2020)',
  },
];

/** Short, sourced caveat shown wherever the app projects a date. */
export const PROJECTION_CAVEAT =
  'Projections use population averages from the literature, adjusted by your own logged rate. They are estimates, not predictions, and they move as your data comes in.';
