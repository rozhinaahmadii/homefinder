import { FLAG_CODES } from './core/types';

type FlagCode = (typeof FLAG_CODES)[number];

export const flagMessages: Record<FlagCode, string> = {
  PRICE_IMPLAUSIBLE: 'The price looks unusually high or low for this area; confirm it is correct.',
  CURRENCY_NOT_PLN: 'The price is listed in a foreign currency; verify the amount.',
  AREA_IMPLAUSIBLE: 'The listed area is outside the normal range; check the floor plan.',
  AREA_MISMATCH_DESCRIPTION: 'The area in the description differs from the listed figure; check which is correct.',
  ROOMS_MISSING: 'The number of rooms was not provided; ask the seller for details.',
  ROOMS_MISMATCH_TITLE: 'The title and the room count field disagree; confirm the actual number of rooms.',
  FLOOR_EXCEEDS_TOTAL: 'The floor number is higher than the total floors listed; one value may be wrong.',
  FLOOR_MISMATCH_DESCRIPTION: 'The floor in the description does not match the floor number field.',
  FEATURE_CONTRADICTS_DESCRIPTION: 'A listed feature appears to contradict the description; read it carefully.',
  DATE_IN_FUTURE: 'The publication date is in the future; the listing date may be incorrect.',
  IMAGE_MISSING: 'No photo is available for this listing.',
  DESCRIPTION_THIN: 'The description is very short; ask the seller for more details.',
  LOCATION_INCOMPLETE: 'The district was not provided; the exact location may be harder to assess.',
};
