# Phase 9B — Final Product API Integration

Phase 9B wires the final product API. This is final product integration, not demo work.

The public route is:

`GET /api/public/matches/:fixtureId/product-intelligence`

It returns the public-safe `FinalProductIntelligence` object produced by the existing
Product Agent mapper. It calls the Product Agent function directly; it does not expose
or proxy the protected internal Product Agent HTTP route, and it does not require
internal authentication because the mapped output is public-safe.

The route does not expose `decision_context`, SignalCore output, raw/internal context,
signals, `signal_brief`, or other internal signal details. It also does not expose
prediction, probability, betting, wagering, or related fields.

The frontend is unchanged in this phase. The next phase should wire the final product
frontend UI to this route.
