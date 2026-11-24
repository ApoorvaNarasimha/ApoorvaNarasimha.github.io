// Section objects for the nav (isometric cubes, js/iso.js).
import { isoURL } from './iso.js';

export const SECTION_ITEM = { start: 'grass', projects: 'pickaxe', next: 'compass', contact: 'heart' };

// A small icon, for the nav.
export function itemIcon(name, size = 32) {
  const img = new Image(size, size);
  img.src = isoURL(name); img.alt = ''; img.className = 'vx-icon'; img.decoding = 'async';
  return img;
}
