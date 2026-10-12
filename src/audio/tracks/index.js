// Track registry: id -> song definition.
import title from './title.js';
import set1 from './set1.js';
import set2 from './set2.js';
import set3 from './set3.js';

export const TRACKS = { title, ...set1, ...set2, ...set3 };
