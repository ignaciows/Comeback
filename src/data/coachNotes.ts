import type { MovementPattern } from '@/domain/types';

/**
 * Why each part of a lift matters, in a coach's words.
 *
 * The app already told you *what* to do — setup, execution, cues, mistakes.
 * What it never said is *why any of it matters*, and that is the difference
 * between someone following instructions and someone who can correct
 * themselves when the instructions do not quite fit. "Elbows at sixty degrees"
 * is a rule you forget by next week. "Flared elbows put the shoulder at the
 * end of its range under load, which is where it complains" is a reason you
 * keep.
 *
 * Written by movement pattern rather than by exercise, because that is the
 * level the reasons live at: every horizontal press wants the same shoulder
 * blades, whatever is in your hands. Sixty-one exercises with individually
 * written rationales would drift apart within a month.
 *
 * Sources are the same spine as everything else the app asserts — see
 * `trainingPrinciples.ts`. Where a claim is technique convention rather than a
 * tested finding, it says so instead of borrowing authority it does not have.
 */

export type CoachNote = {
  /** What the reason is about. */
  title: string;
  /** The reason. Two sentences, addressed to the lifter. */
  why: string;
};

export type CoachNotes = {
  /** Why the setup position is worth the seconds it costs. */
  position: CoachNote;
  /** Why the bottom of the rep is where the work is. */
  range: CoachNote;
  /** Why the way you come back up decides what you get. */
  drive: CoachNote;
  /** What should be doing the work, and what it means if something else is. */
  focus: CoachNote;
  /** How to get more out of this over weeks, not within one set. */
  progress: CoachNote;
};

const PRESS_PROGRESS: CoachNote = {
  title: 'Getting more out of it',
  why: 'Pressing strength climbs slowly and in small steps — 2.5 kg on a bar is a real week. Add reps inside your range first, and only add weight once the top of the range is clean.',
};

const PULL_PROGRESS: CoachNote = {
  title: 'Getting more out of it',
  why: 'Backs respond to volume more than to heroics on any single set. Two or three more clean reps a week beats a jump in weight that turns the movement into a swing.',
};

export const COACH_NOTES: Record<MovementPattern, CoachNotes> = {
  horizontal_push: {
    position: {
      title: 'Why the setup is half the lift',
      why: 'Pulling the shoulder blades back and down before you unrack gives the arm bone something solid to press away from. Press off a loose shoulder and the joint takes load at the end of its range, which is where it starts complaining.',
    },
    range: {
      title: 'Why you go all the way down',
      why: 'The chest does most of its work stretched, at the bottom. Stopping short keeps the weight impressive and removes the part of the rep that grows anything.',
    },
    drive: {
      title: 'Why the elbows stay tucked',
      why: 'Elbows flared straight out to the sides put the shoulder in its most vulnerable position under the heaviest part of the lift. Around sixty degrees from the torso keeps the chest doing the work and the joint out of trouble.',
    },
    focus: {
      title: 'What you should feel',
      why: 'Chest and triceps, with the shoulders helping. If the front of your shoulder is doing all of it, your elbows are too wide or your shoulder blades came unglued halfway up.',
    },
    progress: PRESS_PROGRESS,
  },

  vertical_push: {
    position: {
      title: 'Why you brace before you press',
      why: 'Pressing overhead with a loose trunk means the weight travels into your lower back instead of up. Squeeze the glutes and ribs down first, and the bar goes where you point it.',
    },
    range: {
      title: 'Why the head goes through',
      why: 'Finishing with the bar in front of your face leaves the shoulder holding a lever it cannot lock out. Pushing your head through at the top puts the weight over the middle of your body, where the skeleton carries it.',
    },
    drive: {
      title: 'Why it is slower than you want',
      why: 'The overhead press has the smallest muscles and the longest range of any press, so it progresses slower than everything else you do. That is the movement, not you.',
    },
    focus: {
      title: 'What you should feel',
      why: 'Front and side shoulder, then triceps at the lockout. Low back doing the work means you leaned back to get the bar up — lighter, and brace first.',
    },
    progress: PRESS_PROGRESS,
  },

  horizontal_pull: {
    position: {
      title: 'Why the back stays flat',
      why: 'A flat, braced spine is what lets the hips hold you in position while the arms work. Round it and the lower back becomes the limit long before the back muscles are done.',
    },
    range: {
      title: 'Why you let it stretch at the bottom',
      why: 'Letting the shoulder blades travel forward at the bottom is the loaded stretch the back grows from. Locking the shoulders in place and moving only the elbows turns a row into an arm exercise.',
    },
    drive: {
      title: 'Why the elbows lead',
      why: 'Think about driving the elbows back past your ribs rather than about pulling with your hands. Your arms will always be the weak link if you let them start the rep.',
    },
    focus: {
      title: 'What you should feel',
      why: 'Between and across the shoulder blades, plus the lats down the sides. Biceps only usually means the elbows never got behind the torso.',
    },
    progress: PULL_PROGRESS,
  },

  vertical_pull: {
    position: {
      title: 'Why you start from a full hang',
      why: 'Starting with the arms straight and the shoulders up by the ears gives the lats their whole range. Beginning from a half-pulled position hides how much you can actually do.',
    },
    range: {
      title: 'Why the chest comes to the bar',
      why: 'Leading with the chest rather than the chin puts the shoulder blade into the position the lats pull from. Chin-over-the-bar with a rounded upper back is a rep the neck did.',
    },
    drive: {
      title: 'Why you pull the elbows to your pockets',
      why: 'The lat runs from your upper arm to your lower back, so its job is driving the elbow down and back. Aim the elbows at your back pockets and the right muscle starts the rep.',
    },
    focus: {
      title: 'What you should feel',
      why: 'The outside of your back, under the armpit, and across the mid-back. Forearms burning out first is a grip limit, not a back limit — straps are a reasonable answer.',
    },
    progress: PULL_PROGRESS,
  },

  squat: {
    position: {
      title: 'Why the whole foot stays down',
      why: 'The foot is the only thing touching the ground, so everything above it is built on where the pressure sits. Heels lifting or knees caving are the foot losing the argument, not a knee problem.',
    },
    range: {
      title: 'Why depth is not optional',
      why: 'Quads and glutes both get most of their stimulus below parallel. A heavier half squat trains less muscle than a lighter full one, and it is the version that leaves the knees under-prepared.',
    },
    drive: {
      title: 'Why you come up as one piece',
      why: 'If the hips shoot up first, the bar stays put and the squat turns into a good morning with your back holding the difference. Drive the chest and hips at the same speed.',
    },
    focus: {
      title: 'What you should feel',
      why: 'Quads and glutes, with the trunk working hard to stay upright. Lower back fatigue arriving before leg fatigue means the torso is falling forward — check ankle range and bar position.',
    },
    progress: {
      title: 'Getting more out of it',
      why: 'Squats punish a bad week harder than most lifts, so judge progress over a month rather than session to session. Depth and control first, weight after.',
    },
  },

  hinge: {
    position: {
      title: 'Why the bar stays against you',
      why: 'Every centimetre the bar drifts forward is extra leverage on your lower back. Dragging it along your legs is not a style choice, it is what keeps the load on the hips.',
    },
    range: {
      title: 'Why range is set by your hamstrings, not the floor',
      why: 'Go down as far as you can while the back stays flat, and stop there. Chasing the ground by rounding turns a hip movement into a spine movement.',
    },
    drive: {
      title: 'Why you push the ground away',
      why: 'Thinking "pull" makes the back do it. Thinking "push the floor away and stand up" puts the legs and hips first, which is where the strength is.',
    },
    focus: {
      title: 'What you should feel',
      why: 'Hamstrings stretching on the way down, glutes finishing the lift at the top. A back pump is normal; a back that gives out before the hamstrings is a form signal.',
    },
    progress: {
      title: 'Getting more out of it',
      why: 'Heavy hinges cost more recovery than anything else in the gym. Adding a set is usually a better idea than adding a lot of weight.',
    },
  },

  lunge: {
    position: {
      title: 'Why the stride length decides the exercise',
      why: 'A long step loads the glute of the front leg; a short one loads the quad. Neither is wrong, but drifting between them week to week means you never progress either.',
    },
    range: {
      title: 'Why the back knee goes low',
      why: 'Dropping the back knee close to the ground is what takes the front hip through its full range. Cutting it short makes the set easier without making it shorter.',
    },
    drive: {
      title: 'Why you push through the front heel',
      why: 'Driving through the front heel keeps the glute in the movement. Pushing off the back toes turns it into a step-up your rear leg is doing half of.',
    },
    focus: {
      title: 'What you should feel',
      why: 'Front-leg quad and glute, and your balance working. Wobbling is part of it early on — go lighter rather than shortening the range to stay steady.',
    },
    progress: {
      title: 'Getting more out of it',
      why: 'Single-leg work exposes side-to-side differences that a barbell hides. Match the weaker side and let the stronger one wait.',
    },
  },

  isolation: {
    position: {
      title: 'Why the joint stays still',
      why: 'An isolation movement only isolates while one joint is doing the work. The moment your torso starts helping, the load moves off the muscle you came here for.',
    },
    range: {
      title: 'Why the stretch is the point',
      why: 'Small muscles get most of their stimulus at the lengthened end. The last few degrees at the bottom are the ones people skip and the ones that count.',
    },
    drive: {
      title: 'Why slower is better here',
      why: 'There is no momentum to hide behind on a lift this small, and swinging simply moves the work elsewhere. Control both directions and use a weight that allows it.',
    },
    focus: {
      title: 'What you should feel',
      why: 'One muscle, clearly, and nothing else straining. If you cannot tell where it is working, the weight is too heavy to feel anything with.',
    },
    progress: {
      title: 'Getting more out of it',
      why: 'Isolation lifts progress in reps far more often than in weight. Going from 10 to 14 clean reps is real progress; adding 5 kg and swinging is not.',
    },
  },

  carry: {
    position: {
      title: 'Why posture is the exercise',
      why: 'A carry trains your ability to hold a position while everything tries to pull you out of it. The moment you slump, you are just walking with weights.',
    },
    range: {
      title: 'Why distance and time replace reps',
      why: 'There is no rep to count, so the dose is how far or how long you stay solid. Stop when the posture breaks, not when the grip does.',
    },
    drive: {
      title: 'Why the steps stay short',
      why: 'Long strides make the trunk swing side to side and hand the work to momentum. Short, deliberate steps keep the load on the trunk where it belongs.',
    },
    focus: {
      title: 'What you should feel',
      why: 'Everything from the grip to the trunk to the upper back, working at once. That whole-body demand is the reason carries are worth the time.',
    },
    progress: {
      title: 'Getting more out of it',
      why: 'Add distance before weight. A heavier carry you cannot hold a position under is training a slump.',
    },
  },

  core: {
    position: {
      title: 'Why a brace is not a suck-in',
      why: 'Bracing means stiffening the whole trunk as if expecting a punch, not pulling your stomach in. One makes you solid under load; the other makes you smaller.',
    },
    range: {
      title: 'Why holding still is the work',
      why: 'The trunk mostly earns its keep by resisting movement rather than creating it. A position you can hold without shifting is doing more than a rep that flops.',
    },
    drive: {
      title: 'Why you breathe through it',
      why: 'Holding your breath makes a hold feel harder without making it more effective. Short, shallow breaths keep the brace and let you last long enough to matter.',
    },
    focus: {
      title: 'What you should feel',
      why: 'A deep, even tightness across the whole midsection. Lower back pinching means the hips have dropped and the spine is taking the position instead.',
    },
    progress: {
      title: 'Getting more out of it',
      why: 'Once you can hold a position well past a minute, more time stops teaching you much. Make the position harder rather than the clock longer.',
    },
  },
};

export function coachNotesFor(pattern: MovementPattern): CoachNotes {
  return COACH_NOTES[pattern] ?? COACH_NOTES.isolation;
}

/** The stages, in the order they are shown, so the view cannot reorder them. */
export const COACH_STAGE_ORDER: (keyof CoachNotes)[] = [
  'position',
  'range',
  'drive',
  'focus',
  'progress',
];
