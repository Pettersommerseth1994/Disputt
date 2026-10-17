// Role / reveal / state illustrations and decorative bits.
import { eyeImpostor, eyeLoyal, eyeRight, eyeWrong, eyeWait } from './eyes.mjs';
import { crown, lipsArt, star, sparkle, blobs, scribbleUnderline, scribbleCircle } from './decor.mjs';
import { bil, bilLid, hytte, hytteLid } from './modes.mjs';
import { limeLid } from '../characters/lime.mjs';
import { mandarinLid } from '../characters/mandarin.mjs';

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
  bil, // the two ways to play: a car (one phone) and a cabin (a phone each)
  hytte,
  'bil-lid': bilLid, // the same two eyes shut: the lids that blink over them (public/css/screens.css)
  'hytte-lid': hytteLid,
  'lime-lid': limeLid, // the green and the orange eye on the start screen shut: the lids that blink over them
  'mandarin-lid': mandarinLid,
};
