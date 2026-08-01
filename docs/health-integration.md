# Connecting Apple Health, Apple Watch, Renpho and MIKUY

The integration is installed and wired up. `@kingstinct/react-native-healthkit`
is a dependency and its config plugin is in `app.json`, so any development or
production build reads Health; Expo Go cannot, by design.

## Why Expo Go cannot do it

Expo Go is a fixed app containing the native modules Expo ships. HealthKit is
not one of them, and no JavaScript update can add native code to an app that is
already installed. A **development build** is Comeback compiled with the modules
this project declares, installed on your device; it still loads JS updates over
the air exactly like Expo Go does.

## What is already built

| Piece | File | State |
| --- | --- | --- |
| Port every source implements | `src/services/health/HealthDataProvider.ts` | done |
| Apple Health implementation | `src/services/health/AppleHealthDataProvider.ts` | done |
| Native module boundary | `src/services/health/native/appleHealth.ts` | done, reports unavailable without the package |
| Import rules (dedupe, precedence, source tagging) | `src/services/health/sync.ts` | done, unit-tested |
| Writing an import into state | `applyHealthSync` in `src/store/useAppStore.ts` | done |
| Connect screen | `app/sources.tsx` | done |

The native module is loaded through a runtime require, so the current bundle —
without the package — starts normally and reports Health as unavailable.

## Building it

The package and its plugin are already in place, so this is the whole step:

```bash
eas build --profile preview --platform ios
```

This needs an Apple Developer account to sign for a physical device.

## Matching the native API

`native/appleHealth.ts` mirrors @kingstinct/react-native-healthkit v14
precisely, because getting it wrong fails inside a `try/catch` and reads as
"no data" — indistinguishable from a user who logged nothing. The details
that matter:

- Sample dates are `Date` objects, not strings.
- Queries take `{ filter: { date: { startDate, endDate } }, limit }`, where a
  non-positive `limit` means "all".
- `requestAuthorization` takes `{ toRead: [...] }`, not a bare array.
- `isHealthDataAvailable()` is synchronous.
- Units are passed explicitly on every quantity query, so a reading never
  depends on device locale.
- Asleep is values 1, 3, 4 and 5. **`awake` is 2**, sitting between them, so
  filtering on `value >= 1` counts time awake in bed as sleep.

## Renpho

Renpho has no public API and does not need one. In the Renpho app, enable Apple
Health syncing; weight and body-fat readings land in Health and Comeback reads
them from there, tagged `renpho`.

## MIKUY

MIKUY writes what you eat into Apple Health as dietary samples — energy,
protein, carbohydrates and fat. Comeback reads them back and sums each day,
since every meal is a separate sample. That is the whole integration: no
account to link, no API between the two apps.

Those daily totals are the nutrition component of **Fuel**
(`domain/fuel/calculateFuel.ts`), scored against the calorie and protein
targets the plan already computes.

## What the Watch adds

- **Sleep** → fills the check-in's sleep hours when you have not typed one.
- **Workout duration, pauses and heart rate** → replaces the values currently
  derived from set timestamps in `domain/training/sessionMetrics`, with the same
  shape, so nothing downstream changes.
- **Steps and active energy** → how much the day already took out of you, before
  training. Feeds readiness.
- **Resting heart rate and HRV** → the recovery signals the momentum model was
  designed to accept and currently has to do without.

## Rules the import follows

1. A value you typed is never overwritten by an imported one.
2. Every imported value keeps its real source, so it stays correctable.
3. Importing twice changes nothing — days are matched, not appended.
