# Body type, and what it actually changes

The request was to work out the best training plan for each body type. The
honest answer has two halves: most of the popular framework does not survive
contact with the evidence, and the part that does survive is more useful than
the part that does not.

---

## What does not hold up

**Somatotypes.** Ectomorph, mesomorph, endomorph comes from Sheldon in the
1940s, refined into the Heath–Carter method that is still used in sports
science today. It is worth being precise about what Heath–Carter is: a
*descriptive* scoring of how someone looks right now, from skinfolds, bone
breadths and limb girths. It describes a physique. It was never validated as a
predictor of how anyone responds to training, and it is not used that way in
the literature.

The response data cuts against the popular version. Hubal et al. (2005) put
585 people through the same twelve-week arm training programme and measured
the results: muscle size change ranged from roughly zero to over 50%, and
strength from 0% to over 250%. Enormous individual variation — and not
explained by build. Some of the largest responders were slight; some of the
smallest were not.

So "you are an ectomorph, therefore train like this" is a horoscope in gym
clothes. Comeback does not ask for it and does not use it.

**"Hardgainers need more heavy work."** There is no evidence that people who
gain slowly need a different rep range. What slow gainers usually have is a
smaller frame, less training history than they think, or an intake that does
not support the goal — all of which the app already measures directly.

---

## What does hold up, and is used

### 1. How much room is left

Fat-free mass index — lean mass ÷ height², normalised for height — is the
honest measure of how muscular someone already is. It is mass adjusted for
frame, not a bodyweight a tall person can never reach.

Kouri et al. (1995) measured it across drug-free and steroid-using lifters;
the drug-free population topped out around 25. Comeback uses that as the
ceiling and reports the distance to it as **muscle still available**.

This matters because it is the one thing that genuinely changes what a plan
should do. Someone at FFMI 17 will gain on almost any sensible programme.
Someone at 23 will not, and needs the plan spent on specific weak points
rather than on more of everything.

`developed` measures position between an untrained floor (15) and that ceiling,
not a raw fraction of it — dividing by 25 squashed every living person into the
top third of the scale and made two very different builds draw identically.

### 2. Leverages

Limb lengths relative to torso change which lifts suit a person. This is
geometry and it is not controversial:

- **Long femurs** force the hips back in a back squat until it is closer to a
  hinge, which trains less quadriceps for the same effort. A front squat, hack
  squat or leg press keeps it a squat.
- **Long arms** lengthen the bench press stroke — more range, more shoulder
  strain at the bottom — and shorten the deadlift's, which is why long-armed
  lifters usually pull well and press badly.

So the app asks two questions with three answers each, and swaps exercises
accordingly. It does **not** change how hard anyone trains or how many sets
they get; those come from the plan and from what the person is actually doing.

### 3. Frame size

The wrist is almost entirely bone and connective tissue: it barely moves with
training or with fat, which makes it the one cheap proxy for skeletal frame.
Casey Butt's regressions on drug-free record holders use wrist and ankle to
predict maximum muscular bodyweight; Comeback uses the wrist term only, since
asking for an ankle measurement to slightly sharpen a drawing is a bad trade.

It is optional. Without it the app assumes a middle frame and says so.

### 4. Proportion, when the goal is to look a certain way

Perceived muscularity tracks shoulder-to-waist ratio more than it tracks mass.
That is why lateral delts and upper back pay off visually far above their
contribution to bodyweight — and it is an argument about geometry again, not
about anyone's type. When the app sees a narrow taper it emphasises shoulders
and back, and says exactly that as the reason.

---

## The drawing

`src/features/body/BodyRender.tsx` draws a silhouette whose shoulder, chest,
waist and hip widths and limb thicknesses all come from the composition model.
Muscle widens the top, fat widens the middle — which is why two people at the
same weight and height can look nothing alike, and why the drawing is worth
showing at all.

Put two side by side — now, and the end of a phase — and the difference on
screen is exactly the difference the plan predicts, because the projected
figure is drawn from the same lean and fat numbers the plan already reports in
kilograms. **When the plan predicts very little, the two bodies look almost
identical.** That is the honest outcome, and there is a test asserting it.

Two things it deliberately is not:

- **Not a photo scan.** No image is taken, uploaded or analysed. Everything is
  arithmetic on numbers the user already entered or imported from a scale.
- **Not a promise.** It is a silhouette carrying proportions, which is all the
  underlying numbers support. It is not a rendering of what anyone will look
  like.

---

## Sources

- Kouri, Pope, Katz & Oliva (1995). *Fat-free mass index in users and nonusers
  of anabolic-androgenic steroids.* Clinical Journal of Sport Medicine.
- Hubal et al. (2005). *Variability in muscle size and strength gain after
  unilateral resistance training.* Medicine & Science in Sports & Exercise.
- Carter & Heath (1990). *Somatotyping: development and applications.*
  Cambridge University Press. (For what somatotyping is, and is not, for.)
- Deurenberg, Weststrate & Seidell (1991). *Body mass index as a measure of
  body fatness.* British Journal of Nutrition. (The fallback estimate, used
  only when no scale reading exists, and always flagged as an estimate.)
- Butt, C. *Your Maximum Muscular Bodyweight and Measurements.* (Frame-size
  regressions from drug-free record holders.)

---

## Where the code is

```
src/domain/body/composition.ts   lean/fat split, FFMI, frame, the shape
src/domain/body/bodyType.ts      what those imply for training
src/features/body/BodyRender.tsx the silhouette
app/body-shape.tsx               now versus each phase
tests/body.test.ts               including that a flat plan draws flat
```
