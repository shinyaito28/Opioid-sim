import { convertFromStandardUnit, DRUG_UNITS, getDoseUnitForDrug } from './drugs.js';

// Stored rates are absolute. Recompute the weight-normalized label after weight changes.
export function infusionDisplay(event, weight) {
  const unit = DRUG_UNITS[event.drug]?.includes(event.originalUnit) ? event.originalUnit : `${getDoseUnitForDrug(event.drug)}/hr`;
  return {
    unit,
    value: convertFromStandardUnit(event.rate, unit, weight, event.drug)
  };
}
export function infusionText(event, weight) {
  try {
    const {
      value,
      unit
    } = infusionDisplay(event, weight);
    return `${Number(value.toPrecision(6))} ${unit}`;
  } catch {
    return `${event.rate} ${getDoseUnitForDrug(event.drug)}/hr`;
  }
}
