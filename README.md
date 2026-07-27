# Comeback

Adaptive training app for coming back after a break. Built with Expo (SDK 54),
React Native, TypeScript and expo-router.

Comeback answers four questions every day:

- How am I today?
- Should I train?
- What session is mine today?
- Is my momentum building or slipping?

It is not a generic gym tracker. It keeps a model of what you planned, what you
did, how recovered you are and how much of your previous level you have back —
and it explains every number it shows.

---

## Run it

```bash
npm install
npx expo start        # scan the QR with Expo Go (SDK 54) on your iPhone
```

The whole MVP runs on device with no backend. Data is stored locally and
survives restarts.

```bash
npm run typecheck     # tsc --noEmit
npm test              # domain + end-to-end flow tests (Vitest)
```

## Publishing

The project is linked to EAS as `@parkyparking/comeback`
([dashboard](https://expo.dev/accounts/parkyparking/projects/comeback)) and
EAS Update is configured.

```bash
export EXPO_TOKEN=...                        # never commit this
eas update --branch preview --environment preview --message "..."
```

The project targets **SDK 54**, which is the newest SDK the App Store build of
Expo Go supports. Updates published on that runtime (`exposdk:54.0.0`) open
directly in Expo Go from the project's Home screen — no dev server needed.

For a standalone install, independent of Expo Go:

```bash
eas build --platform ios --profile preview   # requires an Apple Developer account
```

## The first run

1. Four inputs: goal, body weight, height, days per week. Everything else
   starts on a defensible default and is editable in Profile.
2. See your plan: routine, target date, sessions to get there, calories and
   protein.
3. Land on **Today**: momentum, today's recommendation, readiness.
4. Log a check-in, start the recommended session, log sets, finish.
5. Momentum updates and explains why.
6. Log body weight; **Plan** reprojects from your real rate.

To see the models working with history behind them, use **Profile → Load sample
history**. It writes the starting profile plus four weeks of generated sessions
and check-ins; everything it creates is editable and behaves exactly like data
you logged yourself.

## What is in the MVP

| Area | State |
| --- | --- |
| Onboarding → profile, goal, schedule, first routine | done |
| Daily check-in and readiness against your own baseline | done |
| Daily recommendation (full · reduced · recovery · rest · catch-up · free) | done |
| Active session: sets, reps, RIR, warm-ups, rest timer, substitutions, reordering | done |
| Momentum with per-day explanations and history | done |
| Comeback Progress against a measured baseline | done |
| Progress: consistency, volume, per-exercise 1RM trend, body weight, target date | done |
| Plan strategies (cut → bulk) switchable at any time, with the cost in days | done |
| Target date, milestones, session track, calorie and protein targets | done |
| Per-exercise technique: setup, execution, cues, common mistakes | done |
| Method screen: the findings behind the plans, with sources | done |
| Motion system: live momentum ring, heartbeat, time-of-day ambient | done |
| Routine editing, gym equipment inventory, history, corrections | done |
| Local persistence | done |
| Supabase + auth, Apple Health / Watch, Renpho, notifications | not started (ports in place) |

## Models

All of them live in `src/domain/**` as pure functions with no React, no I/O and
unit tests. Weights and thresholds are in `src/domain/config.ts`.

**Momentum (0–100)** — strength of your recent trajectory. Plan adherence 35% ·
recent consistency 20% · performance progression 20% · recovery 15% · logging
regularity 10%. Smoothed with an EMA and capped per day, so one session cannot
swing it. Rescheduling costs less than skipping; planned rest costs nothing.

**Comeback Progress (0–100)** — how much of your previous level is back,
independent of Momentum. Estimated 1RM on matched exercises, weekly volume and
frequency, against a baseline measured from your own first sessions.

**Readiness (0–100)** — sleep, sleep quality, energy, soreness, stress and
motivation, compared against your rolling baseline.

**Daily recommendation** — a transparent rule engine. One outcome, the factors
it weighed, a written reason and a confidence level.

**Plan projection** — where the current strategy leads: target date, sessions
remaining, the lean/fat split of the projected change, and a muscle-gain ceiling
set by training age. Rates come from the applied literature and are blended with
the rate your own scale shows, so the projection converges on reality. Switching
strategy recomputes everything from the progress you already have — nothing
resets. See `src/data/trainingPrinciples.ts` for the sources.

Every model reports `low | medium | high` confidence and refuses to produce a
number when the data does not support one.

## Architecture

```
app/          expo-router routes (thin)
src/
  design-system/  tokens, type scale, icons
  components/     Screen, Section, Metric, buttons, inputs, sheets, charts
  features/       screen-level composition per area
  domain/         pure models: momentum · recommendations · comeback · readiness · trajectory · training
  data/           exercise library, routine templates
  services/       storage · health · analytics ports, Supabase schema
  store/          Zustand, persisted and versioned
  utils/          dates, ids, maths
tests/            Vitest
```

Three ports keep the app free of vendor lock-in:

- `StorageAdapter` — AsyncStorage today, Supabase later.
- `HealthDataProvider` — `ManualHealthDataProvider` today; Apple Health, Apple
  Watch and Renpho register the same interface later.
- `Analytics` — event vocabulary defined, no tracker wired up.

`src/services/supabase/schema.sql` holds the full server schema, including RLS
policies and indices, ready to apply when the project is provisioned.

## Design

Dark, quiet, information-first. One accent colour, semantic colours used
sparingly, separation through space and typography rather than nested cards. No
motivational copy, no emoji. See `src/design-system/tokens.ts` — nothing outside
that file hardcodes a colour, radius or spacing value.

### Motion

The app should read as something that is running, not a page that was printed.
`src/design-system/motion.ts` defines one heartbeat that everything ambient
reads from, so the screen breathes in phase instead of drifting: the momentum
ring draws itself and sweeps continuously, live dots pulse where a value is
being kept current, numbers count to their new value rather than snapping,
sections land in a stagger, buttons settle under the finger, and a single
time-of-day glow sits behind the content. Amplitudes are small by design
(≤6 % scale, ≤0.25 alpha) and every loop stops when the system asks for reduced
motion.

## Privacy

Health and body data is treated as sensitive. It never leaves the device in this
version: no network calls, no analytics backend, no third-party SDKs. When
Supabase is added, every table is behind row-level security scoped to the owner,
and every health value keeps its source (`manual`, `apple_health`, `apple_watch`,
`renpho`, `calculated`) so imported values stay correctable.

See `COMEBACK_BUILD_PLAN.md` for the audit, the architecture decisions and the
phase plan.
