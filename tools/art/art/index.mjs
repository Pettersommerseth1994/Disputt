// Role / reveal / state illustrations and decorative bits.
import { eyeImpostor, eyeLoyal, eyeRight, eyeWrong, eyeWait } from './eyes.mjs';
import { crown, lipsArt, star, sparkle, blobs, scribbleUnderline, scribbleCircle } from './decor.mjs';

export const ART_SET = {
  'eye-impostor': eyeImpostor,
  'eye-loyal': eyeLoyal,
  'eye-right': eyeRight,
  'eye-wrong': eyeWrong,
  'eye-wait': eyeWait,
  crown,
  lips: lipsArt,
  star,
  sparkle,
  ...blobs,
  'scribble-underline': scribbleUnderline,
  'scribble-circle': scribbleCircle,
};
