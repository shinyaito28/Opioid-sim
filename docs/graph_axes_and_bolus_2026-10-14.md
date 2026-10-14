# Bolus edges, Y axis and reference shading

Validation: all 96 tests passed, including actual Recharts SVG path geometry for the vertical bolus segment, fractional peaks, overlapping infusions, simultaneous/repeated/moved boluses, negative time/midnight, unchanged independent PK fixture samples, positive/monotonic slider scales, Auto/manual scaling, band units and English/Japanese rendering with two range bars. Interactive browser verification remains pending because the Windows screen tool cannot initialize.

## Verified cause

The existing solver applies boluses at the exact event time. With a 100 mcg Fentanyl bolus at minute zero and Bae adult parameters for 70 kg, the old chart samples were Cp=0 at −1 minute and Cp=9.900990099 ng/mL at zero (V1=10.1 L). Linear interpolation drew a false rise during the minute before administration. Fractional events had a second sampling issue: a bolus at minute 0.25 was processed correctly but its instantaneous Cp peak was absent from the one-minute display grid (the next sample was already down to 7.098142094 ng/mL).

The chart now opts into exact event-edge samples. Bolus groups have before/after values at the same x coordinate. The Cp increment is the summed bolus mass divided by V1; Ce is identical across the pair. Infusion boundaries receive one continuous sample, without an artificial jump. These snapshots do not advance the integrator. Existing default samples, PK parameters, RK4 arithmetic and event mass/rate updates are unchanged. The tooltip uses the post-dose value at a bolus timestamp. Older saved comparison traces are retained as recorded.

## Y axis

Auto is the default. Following the user's bar-control request, one slider now adjusts the upper limit directly, with the same square-root mapping and range-bar styling as the X control. The lower bound remains zero. A small readout shows the upper limit and concentration unit; one Auto button restores automatic scaling. Dragging applies immediately. The default slider bounds span 1/20 to five times the automatic upper limit and always remain positive; an existing manual value remains representable if the data changes. Auto includes the current curves, visible saved Ce comparisons and any displayed reference band with 10% headroom. Curves outside a manual upper limit are clipped, with a short notice. The graph is keyed by drug, so a drug change resets its local Y-axis controls to Auto rather than carrying another drug's scale. Y-axis preferences do not alter or persist simulation conditions.

## Shading

The legend is shown only for the reference band actually drawn. Opioid bands use configured analgesiaMin/analgesiaMax. Propofol uses its configured BIS 40–60 maintenance Ce reference; Remimazolam uses its configured opioid-combined maintenance Ce reference. Values are divided by the same display divisor as the curves (Propofol and Remimazolam: ng/mL to mcg/mL). Customized bounds are reflected in the legend. It explicitly says the band is not a safety range. This change adds no respiratory-risk band and does not invent shading for Ketamine or Dexmedetomidine, whose definitions do not supply these band fields.

## Storage provenance checked against main b5b2df3

- Existing: working-state autosave in localStorage, comparison-curve snapshots, named cases, literature references and a smaller parameter display.
- Added during this UI rewrite: Export/Import backup, Restore original, New case, the saved-curve visibility toggle, and the expanded seven-parameter list. These controls were grouped under Models & saved data.
- Save curve appends a comparison snapshot (Cp/Ce/time samples, drug, model-derived name, color and calculation version) to savedTraces; it is included in browser autosave. The original main replaced an identically named snapshot; the new button appends on each click. Show saved curves (4) counts stored snapshots in total, while display filters the selected drug and compatible calculation version and draws their Ce curves. It does not mean four files were written.
- Autosave previously used opioid_sim_data and now writes opioid_sim_data_v5. When importing an older save in the same origin, its raw JSON is copied to opioid_sim_original_before_v5 and the original key is left intact. Browser localStorage is persistent site data, distinct from HTTP/PWA caches and separate for localhost and the production origin. There is no cloud upload.
- Export backup downloads opioid-sim-backup.json via the browser, containing the current state and any retained original JSON. Import reads a user-selected JSON file. Restore original loads the retained older state; it does not erase that backup. New case replaces current simulation conditions while preserving saved cases/curves and is reversible with Undo during the session. No existing user save was deleted during this work.
