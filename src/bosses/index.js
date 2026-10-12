// Boss registry: id -> class
import { Gnarlknot } from './fray.js';
import hollowsB from './hollows.js';
import gardensB from './gardens.js';
import catacombsB from './catacombs.js';
import hushwoodB from './hushwood.js';
import bastionB from './bastion.js';
import cisternB from './cistern.js';
import kilnsB from './kilns.js';
import mirrorB from './mirror.js';
import bellfryB from './bellfry.js';
import archiveB from './archive.js';
import warrensB from './warrens.js';
import frostB from './frost.js';
import loomB from './loom.js';
import cradleB from './cradle.js';
import unwovenB from './unwoven.js';
import dunesB from './dunes.js';
import townB from './town.js';
import echoesB from './echoes.js';

export const BOSSES = {
  gnarlknot: Gnarlknot,
  ...hollowsB,
  ...gardensB,
  ...catacombsB,
  ...hushwoodB,
  ...bastionB,
  ...cisternB,
  ...kilnsB,
  ...mirrorB,
  ...bellfryB,
  ...archiveB,
  ...warrensB,
  ...frostB,
  ...loomB,
  ...cradleB,
  ...unwovenB,
  ...dunesB,
  ...townB,
  ...echoesB,
};
