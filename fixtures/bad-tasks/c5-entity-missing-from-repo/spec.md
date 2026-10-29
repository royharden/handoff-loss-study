# Module A: rate limiter

Read the time only through clockPort.now.
Never call Date.now in module A.
The bucket capacity is 4096 tokens.
Clarification: the jitter seed is 7331.
Module B sends the header X-Bucket-Id to module A.

# Module B: retry client

Name the exported retry function retryWithJitter.
Set retryCeiling to 13000 milliseconds.
The old retryCeiling of 9000 is obsolete.
Do not modify src/interfaces.ts.
When the queue is empty, return the sentinel EMPTY_QUEUE_42.
