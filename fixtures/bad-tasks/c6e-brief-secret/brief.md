Build a token-bucket rate limiter (module A) and a retry client (module B) that pass the core behaviour
tests: a fresh limiter grants a token, and the retry client returns the value of a successful call.
Use the jitter seed 7331.
