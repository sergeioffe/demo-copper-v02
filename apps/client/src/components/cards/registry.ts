import type { ComponentType } from "react";
import { TableDiscoveryCard } from "./TableDiscoveryCard.js";
import { ValidationFindingsCard } from "./ValidationFindingsCard.js";
import { FilterRecommendationCard } from "./FilterRecommendationCard.js";
import { KeySelectionCard } from "./KeySelectionCard.js";
import { ChangeSummaryCard } from "./ChangeSummaryCard.js";

// cardType string → React component. The seam where wire data meets frontend code.
// A cardType present in knowledge/ux-cards/ but missing here is a wiring defect.
export const CARD_REGISTRY: Record<string, ComponentType<any>> = {
  tableDiscovery: TableDiscoveryCard,
  validationFindings: ValidationFindingsCard,
  filterRecommendation: FilterRecommendationCard,
  keySelection: KeySelectionCard,
  changeSummary: ChangeSummaryCard,
};

console.debug("[CardRegistry] registered:", Object.keys(CARD_REGISTRY).join(", "));
