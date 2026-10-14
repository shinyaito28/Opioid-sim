# Simple input verification — 2026-10-14

## Result

Implemented on simplify-input-ui in a separate local copy. The source project and its main branch were not edited. Nothing was pushed or deployed.

The UI uses one shared clock and drug selector, Bolus / Infusion tabs, an editable history, Undo/Redo, and the existing style of graph range bar. Generic repeat notices, planned/administered controls, parallel-pump setup, relative-time presets, fixed graph time buttons, duplicate dosing forms, and graph editing gestures are removed from the normal flow. All conditions participate in the simulation.

Models, units, patient growth estimates, citations, saved scenarios, and saved curves remain available. Multiple or overlapping legacy infusion streams remain intact and calculable; their infusion editing is intentionally disabled rather than implicitly converting them.

## Checks completed

- node --test --test-reporter=spec tests/*.test.js: 77 passed, 0 failed (48 existing + 29 added).
- npm.cmd run build -- --outDir=../opioid-sim-verified-build: success, including service worker and PWA precache generation.
- git diff --check: no whitespace errors.
- Drug/model source is unchanged from the original after newline normalization; package manifest and lockfile are unchanged.
- Existing independent numeric references and all 26 unit conversions pass.
- Added coverage includes retrospective insertion/movement/deletion, same-time bolus and infusion, stop/restart, collision atomicity, finite imported stops, legacy overlap preservation, partial input, midnight, grouped Undo/Redo, backups and failed storage.
- Additional prehistory samples do not change any established sample at time >= 0: deep equality is tested for Fentanyl, Hydromorphone, Propofol, and Remimazolam. RK4 equations and parameters are unchanged.
- English and Japanese full UI server-render smoke checks pass.
- Repeat scheduling tests prove tap/repeat/stop behavior in the shared controller; actual pointer event delivery remains a browser check.
- Review regressions fixed: a time-only edit after changing weight retains the recorded absolute infusion rate; empty hour/minute fields remain pending on blur.

Logs are in the workspace parent: opioid-sim-tests.txt and opioid-sim-build.txt.

## Browser limitation

Resetting the browser JS session and calling cua.getState() still ends before UI retrieval:

    MXC launcher: cannot locate required Windows platform directory: HRESULT 0x80070003

No existing Chrome session was closed. No authentication, security, or permission settings were changed. Screen appearance, real mobile keyboard/focus behavior, real touch/long-press cancellation, and real graph interaction are unverified. Server rendering is not a substitute for those checks.

Build was tested on local Node 22.17.1 / npm 10.9.2. The configured Vercel Node 24 environment was not executed. Build warnings concern Browserslist age and the >500 kB chart bundle; neither blocks the build.

## Local review

From this working copy:

    npm.cmd run preview -- --outDir=../opioid-sim-verified-build --host=127.0.0.1

The main graph range bar retains its square-root mapping, 30-minute lower bound and 10-minute increments; its upper bound now covers the existing 24-hour calculation limit without needing the removed fixed buttons. Exact start/end inputs remain in a collapsed section for narrower windows.

## Data and code recovery

- Schema 5 writes only opioid_sim_data_v5.
- The original opioid_sim_data key is never overwritten. Before importing it, the exact raw string is retained in opioid_sim_original_before_v5.
- If validation or the original backup fails, automatic persistence remains disabled and the original is retained.
- Models & saved data offers JSON export/import and Restore original. These only affect the new working save. Undo can reverse a restore in the current session.
- To revert to the old application, use base commit b5b2df32f16c4060399702b37bf914a1a35317aa in another checkout, or continue using the unchanged original project. Keep the new branch and export schema-5 data before any later migration or rollback.
- No destructive legacy merge was implemented. Original status and pump metadata remain in the raw backup and imported records.
