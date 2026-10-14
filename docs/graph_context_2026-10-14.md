# Graph time context and model picker

The internal zero-minute reference is the clock captured when an empty case is created or patient entry is completed. It is not necessarily the first dose. With existing events, patient completion updates only the entry clock and does not re-anchor stored doses.

Initial display is reference + 0 to +120 minutes. Before manual range adjustment, adding an earlier event extends the start; adding a later event extends the end to at least event time +30 minutes, bounded by the existing 24-hour limit. After manual adjustment, the chosen range stays fixed. Existing event edits do not automatically reset the displayed range.

Example: reference 10:00 initially displays 10:00–12:00. Adding a dose at 09:50 makes the view 09:50–12:00 (130 minutes). A dose at 12:30 extends the end to 13:00 if the view has not been manually adjusted. The reference remains 10:00 and stored dose times are unchanged.

The graph now labels the view bounds, width in minutes, current clock, earliest positive dose for the selected drug, and internal reference. Day offsets remain visible when crossing midnight. The reference explanation is available in its tooltip. There is no new clock input or anchor-edit control.

The compact model picker sits above the plot. New cases default to Auto. Auto resolves through the unchanged age-based selection rules, and the actual resolved name is always shown. Explicit choices stay explicit; selecting Auto removes only that drug's override. Existing population checks remain. Model parameters, coefficients, unit conversion, and PK/PD solver are unchanged by this revision.

81 tests pass, including four new time-context/model regressions and strengthened English/Japanese UI render checks. Actual browser interaction and screenshots are performed by the parent task against the Vercel preview.
