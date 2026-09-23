/**
 * Concept registry — the five fictional studies, in display order.
 *   import { concepts, getConcept } from '../data/concepts';
 * Each plate is drawn by src/components/concepts/<id>/ (contract: the README
 * there). Types and the annotation coordinate system: ./types.ts.
 */
import { halden } from './halden';
import { dental } from './dental';
import { restaurant } from './restaurant';
import { law } from './law';
import { fitness } from './fitness';
import type { Concept, ConceptId } from './types';

export type { Concept, ConceptId, ConceptPalette, ConceptAnnotation, PlateMode } from './types';
export { halden, dental, restaurant, law, fitness };

/** Display order: 01 … 05. */
export const concepts: readonly Concept[] = [halden, dental, restaurant, law, fitness];

export const conceptIds: readonly ConceptId[] = concepts.map((c) => c.id);

const byId = Object.fromEntries(concepts.map((c) => [c.id, c])) as Record<ConceptId, Concept>;

export function isConceptId(id: unknown): id is ConceptId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(byId, id);
}

/** Unknown ids fall back to Concept 01 (Halden): never throws at build. */
export function getConcept(id: ConceptId | string = 'halden'): Concept {
  return isConceptId(id) ? byId[id] : halden;
}
