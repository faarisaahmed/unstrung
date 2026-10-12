// Tile character semantics. Rooms are authored as ASCII grids.
//
//  ' ' or '.'  empty            '#'  solid rock
//  '='  one-way platform        '/'  45° slope rising to the right   '\' slope rising to the left
//  '^'  spikes / thorns         '~'  water (swimmable)                '!' acid/ink (hazard; swimmable w/ Glass Shell)
//  'B'  breakable wall (Bonk)   'G'  cracked floor (Lead Heart)       'C' crystal (Comet Roll)
//  'M'  magnetic solid          'H'  half-block (top half solid; crawlspace below for Pinhole)
//  'O'  grapple hook            'W'  updraft column                   'I' ice (slippery, no wall cling)
//  '*'  fake wall (secret; drawn solid, passable)
//  '0'-'9' door cells (must be on the room border)
//  '@'  player start (only the first room)
//  any other letter: entity marker resolved through the room's `legend`
export const T = {
  EMPTY: 0, SOLID: 1, ONEWAY: 2, SLOPE_R: 3, SLOPE_L: 4, HALF: 5,
};

export const TILE_CHARS = new Set([
  ' ', '.', '#', '=', '/', '\\', '^', '~', '!', 'B', 'G', 'C', 'M', 'H', 'O', 'W', 'I', '*', '@',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
]);

// Collision shape for a tile char given the current ability context.
export function shapeOf(ch) {
  switch (ch) {
    case '#': case 'B': case 'G': case 'C': case 'M': case 'I':
      return T.SOLID;
    case '=': return T.ONEWAY;
    case '/': return T.SLOPE_R;
    case '\\': return T.SLOPE_L;
    case 'H': return T.HALF;
    default: return T.EMPTY;
  }
}

export const isDoorChar = (ch) => ch >= '0' && ch <= '9';
export const isSolidChar = (ch) => shapeOf(ch) === T.SOLID;
// Characters that render as terrain mass
export const isTerrainChar = (ch) =>
  ch === '#' || ch === 'M' || ch === 'I' || ch === '*' || ch === '/' || ch === '\\';
