/**
 * Concept plate registry: which components draw each concept.
 * ConceptPlate.astro picks from here by id. To add or redraw a niche, edit
 * only its folder (concepts/<id>/Before.astro + Layers.astro); the entry here
 * stays the same. Contract: ./README.md.
 *
 * Note: every page that renders a ConceptPlate imports all five drawings, so
 * their CSS ships together. Keep each niche's styles lean.
 */
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { ConceptId } from '../../data/concepts/types';

import HaldenBefore from './halden/Before.astro';
import HaldenLayers from './halden/Layers.astro';
import DentalBefore from './dental/Before.astro';
import DentalLayers from './dental/Layers.astro';
import RestaurantBefore from './restaurant/Before.astro';
import RestaurantLayers from './restaurant/Layers.astro';
import LawBefore from './law/Before.astro';
import LawLayers from './law/Layers.astro';
import FitnessBefore from './fitness/Before.astro';
import FitnessLayers from './fitness/Layers.astro';

export interface PlateDrawing {
  /** The dated site: one root element, position:absolute; inset:0. */
  Before: AstroComponentFactory;
  /** The rebuild: six sibling .cp-layer elements (.cp-l1 … .cp-l6). */
  Layers: AstroComponentFactory;
}

export const drawings: Record<ConceptId, PlateDrawing> = {
  halden: { Before: HaldenBefore, Layers: HaldenLayers },
  dental: { Before: DentalBefore, Layers: DentalLayers },
  restaurant: { Before: RestaurantBefore, Layers: RestaurantLayers },
  law: { Before: LawBefore, Layers: LawLayers },
  fitness: { Before: FitnessBefore, Layers: FitnessLayers },
};

export function getDrawing(id: ConceptId): PlateDrawing {
  return drawings[id] ?? drawings.halden;
}
