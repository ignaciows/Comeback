# Connecting Apple Health, Apple Watch and Renpho

Everything above the native boundary is written and tested. What is missing is a
build that contains HealthKit — Expo Go cannot, by design.

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

## Turning it on

```bash
npx expo install @kingstinct/react-native-healthkit
```

Add the plugin to `app.json`:

```json
["@kingstinct/react-native-healthkit", {
  "NSHealthShareUsageDescription": "Comeback reads your weight, sleep and workouts to adapt your training.",
  "NSHealthUpdateUsageDescription": "Comeback does not write to Health."
}]
```

Then build and install:

```bash
eas build --profile development --platform ios
```

This needs an Apple Developer account ($99/year) to sign for a physical device.
Nothing else about the app changes: the same EAS updates keep working.

## Renpho

Renpho has no public API and does not need one. In the Renpho app, enable Apple
Health syncing; weight and body-fat readings land in Health and Comeback reads
them from there, tagged `renpho`.

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
