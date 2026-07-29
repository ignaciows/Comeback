# What a coach does, and which parts the app can do

A good coach standing next to you in the gym does maybe a dozen distinct
things. Some of them are judgement calls that need eyes on the bar. Most of
them are not — they are decisions from information the app already has, made
by rules the coach could write down. This is the list, split honestly.

## Done, deterministically

| What a coach does | What Comeback does | Where |
| --- | --- | --- |
| Decides the week's shape | Builds the routine so each muscle lands in 10–20 hard sets and is trained about twice | `routineTemplates.ts`, `training/volume.ts` |
| Picks the weight for the next set | RIR autoregulation: more reps left in the tank than target → up one increment, fewer → down | `training/coaching.ts` → `suggestLoad` |
| Decides when the weight goes up | Double progression: reps to the top of the range at a fixed load, then load | `suggestLoad` |
| Warms you up | 50 / 70 / 85 % ramp before the first working set of a compound over 30 kg | `warmupSets` |
| Says one thing during the set | One cue, rotating, external for compounds and internal for isolation | `cueForSet`, `data/coachingCues.ts` |
| Times your rest | 3 min compound, 90 s isolation, cut to 60 s after the last set | `restForSet` |
| Notices you are not recovering | Readiness from sleep, soreness, stress and energy scales the session down before it starts | `domain/readiness.ts`, `training/adaptation.ts` |
| Notices you stopped showing up | Drop-off risk judged against your own usual gap, and the plan reconfigures rather than nagging | `inference/observations.ts`, `plan/verdict.ts` |
| Adjusts the plan when it is not working | Observed rate vs. projected; the verdict can slow, accelerate or rebuild the plan | `plan/verdict.ts` |
| Swaps an exercise the gym cannot do | Substitutions by movement pattern, filtered by that gym's equipment | `data/exercises.ts` → `findSubstitutions` |
| Keeps the record | Every set, pause and skip is logged, and the journal fills a square per tracked day | `store`, `domain/journal.ts` |

Each of these is a pure function with tests. None of them asks a model what
it thinks. That is the point: the same inputs give the same coaching, and
when the app says why, the reason is the actual rule it applied.

## Not done, and not pretended

- **Watching the bar path.** Whether your knees caved or your back rounded
  needs eyes. The app can tell you what to look for and show the movement; it
  cannot see you.
- **Hands-on setup.** Where exactly the bar sits on your back, whether that
  machine's seat height fits your femur.
- **Injury assessment.** Pain gets a limitation field and a suggestion to
  stop, never a diagnosis.
- **Reading the room.** Whether you are having a bad week or a bad year.
  The app has a proxy — check-ins and momentum — and it is a proxy.

## The rule about cueing

Only one instruction is live at a time. Not a checklist. Working memory is
the constraint during a set, and a stack of instructions degrades the rep it
was meant to fix — so the app shows one cue and rotates it by set index.

Which kind depends on the movement, and the evidence genuinely splits:

- **Compounds get external cues** — attention on the *effect*, "push the
  floor away", "bend the bar in half". Wulf's reviews are consistent that
  this beats internal focus for force production and skill learning.
- **Isolation gets internal cues** — the mind-muscle connection, "pinkies
  towards your shoulders". Schoenfeld et al. (2018) found an internal focus
  produced more biceps growth than an external one.

The vivid phrasing is deliberate. "Pinkies to your shoulders" beats
"supinate at the top" because it produces the movement without needing to be
decoded mid-set, out of breath.

## Guided mode

`training.guided` chooses which screen a session opens in.

- **Guided** (`app/guided.tsx`) — one set at a time, whole screen. The
  movement animating, one cue, weight and reps big enough to change without
  looking properly, a progress bar of one segment per working set, and rest
  counted down between them. Tapping the animation opens the full setup for
  that exercise.
- **List** (`app/session.tsx`) — everything at once, for someone who already
  knows the movements.

It defaults to guided, because someone coming back is relearning technique,
and it is a preference rather than a mode you have to be in: both write to
the same session, so a set logged in one is a set logged, and you can leave
mid-session and carry on in the other.
