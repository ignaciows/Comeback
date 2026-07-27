# Comeback — Build Plan

Adaptive training app for coming back after a break. This document records the
audit of the repository, the architecture, and the phased plan.

---

## 1. Repository audit (state before this work)

The repository (`ignaciows/CHAIN`) contained an **unrelated** prior project: a
planetary ecology simulation game (`CHAIN`), built on Expo SDK 57 +
expo-router + TypeScript + Zustand.

| Area | Found | Decision |
| --- | --- | --- |
| `app/` | 9 game routes | Removed |
| `src/engine`, `src/data`, `src/features`, `src/theme`, `src/components` | Game simulation, HUD, biomes | Removed |
| `docs/` | Game science docs, Higgsfield prompts | Removed |
| `package.json` | Expo 57, RN 0.86, React 19, expo-router 57, Zustand 5, Reanimated 4, SVG, AsyncStorage | **Kept** — stack matches the target stack |
| `babel.config.js`, `tsconfig.json` (strict, `@/*` alias) | Correct | Kept |
| `app.json`, `eas.json`, assets | Game branding | Rebranded to Comeback |

No trace of a project called *Maxis* exists in this repository, so there is no
Maxis interface, component or token to purge. The removed code is the CHAIN
game; it is preserved in git history and on the `claude/chain-game-build-kstgk4`
branch, so nothing is lost.

**Conclusion:** the toolchain is sound and reused; every line of product code is
new.

### Risks identified

| Risk | Mitigation |
| --- | --- |
| Supabase is not provisioned (no project, no keys) | Local-first persistence behind a storage port; the full SQL schema + RLS is committed and ready to apply. No product code talks to a network today. |
| Health integrations (Apple Health, Renpho) are unavailable in Expo Go | `HealthDataProvider` port with a `ManualHealthDataProvider`; other providers plug in later without touching features. |
| Momentum/Comeback models can drift into pseudo-science | All models are pure, deterministic, unit-tested functions with explicit confidence levels and stored explanations. |
| Cold-start (no data) makes every metric meaningless | Confidence is a first-class output; screens render explicit "not enough data" states instead of fake numbers. |
| Model tuning will change often | All weights, thresholds and state ranges live in `src/domain/config.ts`. |

---

## 2. Architecture

```
app/                      expo-router routes only (thin; no business logic)
  (tabs)/                 today · train · progress · profile
  onboarding.tsx          5-step flow
  session.tsx             active workout
  ...                     checkin · log-weight · momentum · workout/[id] · history
src/
  design-system/          tokens, typography, Icon, primitives
  components/             Screen, Header, Section, Metric, buttons, inputs, sheets…
  features/               screen-level composition per domain area
  domain/                 pure, testable models (no React, no I/O)
    training/  momentum/  recommendations/  comeback/  readiness/  trajectory/
  data/                   exercise library, equipment, routine templates, seed
  services/
    storage/              StorageAdapter port + AsyncStorage adapter
    health/               HealthDataProvider port + ManualHealthDataProvider
    analytics/            Analytics port + no-op/console adapters
    supabase/             schema.sql (+ RLS) and the migration notes
  store/                  Zustand slices, persisted, versioned
  utils/                  dates, ids, formatting
tests/                    Vitest unit tests for the domain
```

Rules:

- `src/domain/**` imports nothing from React, React Native or the store. Every
  model is a pure function of its inputs, so it is trivially testable and
  swappable.
- Screens read from the store through selectors in `src/store/selectors.ts`;
  they never recompute a model inline.
- Anything the product might later fetch from a device or a server sits behind a
  port (`StorageAdapter`, `HealthDataProvider`, `Analytics`).

### Persistence

Zustand + `persist` middleware over an AsyncStorage adapter, with a schema
version and a migration hook. This is real persistence, not a mock: data
survives app restarts today, and the same shapes map 1:1 onto the committed
Supabase schema, so the swap is an adapter change rather than a rewrite.

### Why not Supabase / TanStack Query / React Hook Form yet

- **Supabase**: no project is provisioned. The schema, RLS policies and indices
  are written and committed (`src/services/supabase/schema.sql`); the client is
  added when keys exist. Shipping an unusable auth wall would block the one
  thing that matters now — logging real workouts.
- **TanStack Query**: it manages *server* state. There is no server yet; adding
  it now would be ceremony around local reads.
- **React Hook Form**: the forms here are 3–6 short numeric/choice fields driven
  by custom inputs (`NumberInput`, `SegmentedControl`, `Scale`). Zod owns
  validation; RHF would add a layer without removing one.

All three are additive later and none of them shape the domain layer.

---

## 3. Models

**Momentum (0–100)** — strength of the recent trajectory. Weighted, normalised
components: plan adherence 35 · recent consistency 20 · performance progression
20 · recovery 15 · logging regularity 10. Smoothed with an EMA and a per-day
change cap, so a single bad day cannot collapse it and returning to training
recovers it progressively. Every update stores before/after, positive and
negative factors and a written explanation.

**Comeback Progress (0–100)** — independent of Momentum. Estimates how much of
the previous level has been recovered, from per-exercise estimated 1RM,
volume and frequency against a baseline. Reports `low | medium | high`
confidence and refuses to report a number before a baseline exists.

**Daily recommendation** — a transparent rule engine producing exactly one of
`full · reduced · recovery · rest · rescheduled · free`, with the factors it
considered, an explanation, and a confidence level.

**Readiness (0–100)** — sleep, sleep quality, energy, soreness, stress,
motivation, compared against the user's own rolling baseline.

---

## 4. Phases

| Phase | Content | Status |
| --- | --- | --- |
| 1 | Audit, cleanup, stack confirmation, strict TS, architecture, design tokens | done |
| 2 | Design system, navigation, base components, loading/error/empty states | done |
| 3 | Data model, storage port, persisted store, seed, Supabase schema | done |
| 4 | Onboarding → profile, goal, availability, first plan | done |
| 5 | Training: routines, exercise library, active session, sets, finish, history, edit | done |
| 6 | Daily check-in, readiness, recommendation engine, Today screen | done |
| 7 | Momentum: calculation, snapshots, factors, history, detail screen | done |
| 8 | Progress: body weight, consistency, performance, Comeback Progress, target date | done |
| 9 | Tests, empty states, error handling, docs | done |
| next | Supabase + auth, Apple Health / Watch, Renpho, notifications, animations, i18n catalogue | not started |

---

## 5. Definition of done for the MVP

- [x] Runs on iPhone through Expo Go (SDK 57).
- [x] Main flow uses no mocks — onboarding → check-in → session → momentum →
      progress is backed by persisted user data.
- [x] Data survives a restart.
- [x] Models are pure and unit-tested.
- [x] Momentum is explainable per update.
- [x] Records can be corrected after the fact.
- [x] No filler screens, no dead buttons.
- [x] Nothing from the previous project remains visible.
