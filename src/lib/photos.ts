/**
 * Real photographs of the three centres, used on /built-at-elite and the home
 * page. Empty until Dhana supplies images that clear the consent rule in the
 * README (no identifiable minors without signed guardian consent on file).
 *
 * To add one: drop the file in src/assets/centres/ and list it here with the
 * centre it shows and a plain description for alt text. Nothing else changes.
 */
import type { ImageMetadata } from 'astro';

export interface CentrePhoto {
  src: ImageMetadata;
  centre: 'Hoppers Crossing' | 'Pakenham' | 'Medavakkam';
  alt: string;
  /** Who confirmed consent status and when, e.g. "DK, 2026-10-01, no people in frame". */
  consent: string;
}

export const centrePhotos: CentrePhoto[] = [
  // Example, once an image exists:
  // { src: (await import('@/assets/centres/hoppers-lanes.jpg')).default, centre: 'Hoppers Crossing', alt: 'Six indoor cricket lanes under lights, empty, nets pulled back.', consent: 'DK, 2026-10-01, no people in frame' },
];
