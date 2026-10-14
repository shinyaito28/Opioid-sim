# Simple input implementation — 2026-10-14

## Agreed scope

Use one drug selector and one HH:mm input, shared by Bolus / Infusion tabs for every drug. Initialize the clock once when patient entry is completed; preserve it while typing, after adding a dose, and when switching tabs. Direct time input and hour/minute repeat controls replace relative-time presets. Keep an explicit Now button and internal day offsets.

Add a bolus only when Add is pressed. Existing entries update in place after a short debounce, on blur, or Enter. Incomplete decimal/time input retains the last valid graph. Valid edits recalculate the complete history without confirmation dialogs. Undo/Redo groups an edit gesture into one reversible operation.

For new histories, each drug has one infusion timeline. The infusion tab has Set rate and Stop; start/change/restart is inferred. Boluses at the same instant remain independent. Show validation/collision errors inline. Preserve multiple legacy streams without merging them. Treat all entries as simulation conditions, with no planned/administered UI.

Keep the graph range bar and remove 6h/12h/24h controls. Do not add new zoom gestures. Keep selected ranges during edits. Keep models, coefficients, conversions, saved traces/scenarios, and English/Japanese switching. Remove repetitive generic use notices from the normal screen; retain concrete model/data errors and attribution.

## Reversibility

Original sources remain untouched. Working branch: simplify-input-ui. Base: b5b2df32f16c4060399702b37bf914a1a35317aa. The schema-4 localStorage key is never overwritten by the new UI. Schema-5 writes use a separate key. Keep a raw copy of the initial legacy save before any new save; failed backup/validation disables persistence rather than destroying the original. Reset/restore functions do not overwrite that original. No push or deployment in this task.

## Verification

- Existing independent numeric reference tests and all unit conversion tests.
- Same-time bolus + infusion; retrospective rates/stops; restart; deleting/moving rate points; preservation of later events.
- Legacy streams and finite stops; undo/redo; unchanged IDs; saved-state validation and raw backup.
- Direct clock entry; midnight/day offsets; repeat stops on release/cancel/blur/visibility change; keyboard and large targets.
- Partial decimals/time stay pending; accepted edits update without adding entries or losing focus; errors retain a labelled last-valid graph.
- Existing bar; no fixed time buttons; range stays fixed during recalculation.
- Build; browser/mobile verification if the approved browser runtime starts. Mark runtime-dependent checks unverified if it still fails.

## Implementation boundaries

Do not change PK/PD model data or numerical integration equations. A sampling-only extension may expose negative-time prehistory while preserving default outputs. Do not install or change authentication/security configuration. Do not publish.
