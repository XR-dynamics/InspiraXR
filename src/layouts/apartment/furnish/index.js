import { living } from './living.js';
import { dining } from './dining.js';
import { kitchen } from './kitchen.js';
import { bedroom } from './bedroom.js';
import { study } from './study.js';
import { bath } from './bath.js';
import { entry } from './entry.js';
import { terrace } from './terrace.js';

/** Furnish the empty shell: every piece is modelled in code from the moodboard; the sofa is the supplied model. */
export function furnish(ctx) {
  for (const room of [living, dining, kitchen, bedroom, study, bath, entry, terrace]) room(ctx);
}
