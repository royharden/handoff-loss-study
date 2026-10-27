Invoices from the metering service charge incorrect amounts. Fix the two defects below.

- `normalizeEvents(raw)` in `src/normalize.ts` drops a raw event only when its id repeats the id of an earlier event, and the first copy stays; quantities that arrive as strings become numbers.
- `buildInvoice(events, customer)` in `src/invoice.ts` bills one customer: each line covers one meter, the units of a line are the sum of the quantities of that customer's events on the meter, and `totalCents` is the sum of the line amounts.
