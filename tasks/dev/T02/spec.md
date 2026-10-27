# Objective

Invoices from the metering service charge incorrect amounts. Fix the two defects below.

- `normalizeEvents(raw)` in `src/normalize.ts` drops a raw event only when its id repeats the id of an earlier event, and the first copy stays; quantities that arrive as strings become numbers.
- `buildInvoice(events, customer)` in `src/invoice.ts` bills one customer: each line covers one meter, the units of a line are the sum of the quantities of that customer's events on the meter, and `totalCents` is the sum of the line amounts.

# Event normalisation

Events on the meter `healthcheck_ping` are internal probes, and `normalizeEvents` excludes every one of them from its output.

`src/types.ts` stays unchanged: the collector and the billing exporter share it.

# Invoice lines

`buildInvoice` prices each line with the unit price of its meter from `PRICING.unitCents`, and meters without an entry use `PRICING.fallbackUnitCents`.

The billing exporter names every exported pricing helper with the inv prefix and the Cents suffix, so `src/invoice.ts` exports its line pricing helper as `invLinePriceCents(meter, units)`: it returns the price in cents of that many billable units of the meter, and `buildInvoice` prices every line with it.

# Collector feed

The promo desk sends free usage through the same collector: `normalizeEvents` adds the flag `promo-credit` to every event whose source is `promo-desk`, and `buildInvoice` counts `promo-credit` units in the units of the line while charging 0 cents for them.

The collector batches small usage, so a line with 1 to 119 billable units is billed as 120 units; `buildInvoice` applies this minimum.

# Invoice limits

The invoice accepts a single event up to `maxEventQuantity: 64000`, and `normalizeEvents` clamps every larger quantity to 64000.

The bound of 10000 in `PRICING` is wrong for invoices.

The invoice groups processor usage under the canonical meter name `vcpu_seconds_v3`: `normalizeEvents` maps the raw meters `cpu` and `vcpu` to `vcpu_seconds_v3`.

# Pricing clarifications

Finance repriced storage after the first draft of this spec: the `storage_gb` meter is billed at 342 cents per unit, applied in `src/invoice.ts`.

The old `storage_gb` price of 290 is obsolete.
