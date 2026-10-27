# Objective

Build the retry planner of the webhook relay. A webhook delivery that fails is tried again after a growing wait, and the relay gives up after a bounded number of attempts.

- `computeDelay(n)` in `src/schedule.ts` returns the wait in milliseconds before a retry, and each retry waits `DEFAULT_POLICY.multiplier` times as long as the retry before it.
- `planNext(delivery)` in `src/dispatch.ts` looks at the latest attempt: a 2xx status gives `done`; any other status is a failed attempt and gives `retry`, with `runAt` equal to the latest attempt time plus the wait from `computeDelay`; once the delivery has used `DEFAULT_POLICY.maxAttempts` attempts, a failed attempt gives `give_up`.
- `retryHeaders(delivery)` in `src/schedule.ts` returns the headers for the retried request and forwards the original headers of the delivery.
- `retryEvent(delivery)` in `src/schedule.ts` returns the telemetry event of a scheduled retry, with `deliveryId` set to the delivery id.

# Backoff schedule

Retry numbering in `src/schedule.ts` is zero-based: `computeDelay(0)` is the wait before the first retry, so the dispatcher passes `attempts.length - 1` when the latest attempt failed.

The first retry of a webhook waits `baseDelayMs: 1500`, set in `src/schedule.ts`; the library default of 240 is wrong for webhook receivers.

# Retry headers

`x-hook-signature` is stripped from the forwarded headers, because the relay signs every retry again further downstream.

# Dispatch decisions

Each retry wait is capped by the retry ceiling of the dispatcher.

`src/contracts.ts` stays unchanged: the delivery workers share it.

# Gateway and telemetry

The gateway routes retried requests by header: every retry carries the header `x-relay-lane` with the value `retry-q7`, which `retryHeaders` in `src/schedule.ts` adds.

Telemetry event names follow the dotted lowercase scheme of the gateway, so the event built by `retryEvent` in `src/schedule.ts` is named `relay.retry.scheduled`.

# Response handling

A 410 response means the receiver has removed the endpoint: the delivery ends with `give_up` at once, even on its first attempt, and the dispatcher checks for it before any retry.

# Dispatch clarifications

Operations confirmed the ceiling for webhook retries after the first draft of this spec: `retryCeiling: 13000`, applied in `src/dispatch.ts`.

The old `retryCeiling` of 9000 is obsolete.
