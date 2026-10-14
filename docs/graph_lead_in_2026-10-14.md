# Graph lead-in

The chart extends its left display edge by the smaller of five minutes or 5% of the stored range width. The initial 0–120 minute range therefore displays −5–120; a 0–30 minute zoom displays −1.5–30. The right edge, stored plotStart, range controls, event times and clock reference stay unchanged. The visible range summary uses the actual chart bounds, including the lead-in.

The display edge is bounded at the existing supported history limit of −1440 minutes, rather than at zero. Midnight labels continue to show day offsets. At that earliest supported boundary no additional margin is added.

The existing solver's first-sample argument supplies any extra negative-time samples. No PK parameters, integration equations or event processing were changed. Previously entered boluses and infusions are included when calculating residual concentration; the UI never prepends invented zero points. Saved comparison traces remain unchanged and are not extrapolated beyond their recorded data. Existing samples remain identical in the regression fixtures.

Validation: all 86 tests passed, including five new cases for scale-dependent padding, supported boundaries, midnight, actual pre-dose samples, past bolus/ongoing infusion residuals, saved data immutability and manual zoom. Browser screenshots remain a separate verification step on the parent environment because this PC's browser automation cannot start.
