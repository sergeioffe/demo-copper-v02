import type { ComponentType } from "react";
import { TableDiscoveryCard } from "./TableDiscoveryCard.js";
import { ValidationFindingsCard } from "./ValidationFindingsCard.js";
import { FilterRecommendationCard } from "./FilterRecommendationCard.js";
import { FilterImpactSummaryCard } from "./FilterImpactSummaryCard.js";
import { KeySelectionCard } from "./KeySelectionCard.js";
import { ChangeSummaryCard } from "./ChangeSummaryCard.js";
import { SourceInputCard } from "./SourceInputCard.js";
import { FieldMappingCard } from "./FieldMappingCard.js";
import { ImportSettingsCard } from "./ImportSettingsCard.js";
import { TablePreviewCard } from "./TablePreviewCard.js";
import { CustomFilterCard } from "./CustomFilterCard.js";
import { QuestionnaireCard } from "./QuestionnaireCard.js";

// cardType string → React component. The seam where wire data meets frontend code.
// A cardType present in knowledge/ux-cards/ but missing here is a wiring defect.
export const CARD_REGISTRY: Record<string, ComponentType<any>> = {
  tableDiscovery:      TableDiscoveryCard,
  validationFindings:  ValidationFindingsCard,
  filterRecommendation: FilterRecommendationCard,
  filterImpactSummary: FilterImpactSummaryCard,
  keySelection:        KeySelectionCard,
  changeSummary:       ChangeSummaryCard,
  sourceInput:         SourceInputCard,
  fieldMapping:        FieldMappingCard,
  importSettings:      ImportSettingsCard,
  tablePreview:        TablePreviewCard,
  customFilter:        CustomFilterCard,
  questionnaire:       QuestionnaireCard,
};

console.debug("[CardRegistry] registered:", Object.keys(CARD_REGISTRY).join(", "));
