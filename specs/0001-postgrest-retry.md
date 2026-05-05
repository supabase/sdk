# PostgREST Client — Automatic Retry Behavior

| Field      | Value                                               |
| ---------- | --------------------------------------------------- |
| Version    | 0.1.0                                               |
| Status     | Draft                                               |
| Date       | 2026-05-05                                          |
| Authors    | Supabase SDK Team                                   |
| References | [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) |

---

## Abstract

This specification defines the automatic retry behavior for PostgREST client libraries. It covers which requests are eligible for retry, which conditions trigger a retry, how delays are computed, and how the behavior is configured. Implementations that conform to this specification will produce consistent, predictable behavior across all Supabase SDK languages.

---

## Definitions

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

| Term              | Meaning                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **attempt**       | A single execution of the HTTP request, including sending the request and receiving (or failing to receive) a response.        |
| **retry**         | A subsequent attempt after a previous attempt has failed with a retryable condition.                                           |
| **initial attempt** | The first attempt for a given request, before any retries.                                                                  |
| **retry count**   | The number of retries performed, not counting the initial attempt. After 3 retries the retry count is 3.                       |
| **network error** | A failure that prevents an HTTP response from being received at all (e.g. connection refused, DNS failure, TCP reset).         |
| **AbortError**    | A platform-specific error indicating the request was cancelled by the caller (e.g. via `AbortController` or equivalent).      |
| **Retry-After**   | An HTTP response header whose value is the number of seconds the client should wait before retrying.                           |

---

## Requirements

### R1 — Eligibility

**R1.1** A request MUST only be retried if its HTTP method is `GET`, `HEAD`, or `OPTIONS`.

**R1.2** A request MUST only be retried if retry behavior is enabled for that request. Retry behavior is enabled by default.

**R1.3** A request MUST NOT be retried if the failure is an AbortError (or the platform-equivalent user cancellation). The error MUST be surfaced to the caller immediately.

### R2 — Retryable Conditions

**R2.1** A `520` HTTP response MUST trigger a retry if the request is eligible (R1).

**R2.2** A `503` HTTP response MUST trigger a retry if the request is eligible (R1).

**R2.3** A network error on an eligible request MUST trigger a retry.

**R2.4** Any response or error not covered by R2.1–R2.3 MUST NOT trigger a retry. The response or error MUST be surfaced to the caller immediately.

### R3 — Limits

**R3.1** An implementation MUST attempt a request no more than 4 times total (1 initial attempt + 3 retries).

**R3.2** After all attempts are exhausted, the implementation MUST surface the last error or response to the caller.

### R4 — Delay

**R4.1** The delay before each retry MUST be strictly greater than zero.

**R4.2** The base delay (before any jitter) MUST increase between successive retry attempts. A fixed base delay across all retries is not permitted.

**R4.3** Each delay (including any jitter) MUST NOT exceed 30 seconds (30,000 ms).

**R4.4** If the response that triggered a retry includes a `Retry-After` header, the implementation MUST use that header's value (in seconds, converted to milliseconds) as the delay for that specific retry, subject to the cap in R4.3.

**R4.5** Implementations SHOULD add random jitter to computed delays. Jitter reduces thundering-herd effects when many clients retry simultaneously.

### R5 — Observability

**R5.1** An implementation MUST attach an `X-Retry-Count` header to every retry attempt. The value MUST be an integer equal to the current retry number (1 for the first retry, 2 for the second, 3 for the third).

**R5.2** The `X-Retry-Count` header MUST NOT be present on the initial attempt.

### R6 — Configuration

**R6.1** An implementation MUST provide a way to disable retry behavior at the client level (globally), applied to all requests made by that client instance.

**R6.2** An implementation MUST provide a way to disable or enable retry behavior per individual request.

**R6.3** Per-request configuration MUST take precedence over global client configuration.

**R6.4** When retry behavior is disabled (globally or per-request), a retryable condition MUST be surfaced to the caller immediately without any retry attempt.

---

## Scenarios

Each scenario describes a stimulus sequence and the required outcome. Scenarios are intended to be directly translatable into conformance tests.

> **Notation**: `→` separates steps in a sequence. `[delay]` indicates a pause between attempts. Error/response descriptions are shorthand for the actual platform constructs.

---

### Eligibility Scenarios

#### `retry-get-520`
A GET request receives a 520 response on the first attempt, then a 200 on the second.

**Stimulus**: `GET → 520 → [delay] → GET → 200`
**Expected**: The caller receives the 200 response. One retry was performed.

---

#### `retry-head-520`
A HEAD request receives a 520 response on the first attempt, then a 200 on the second.

**Stimulus**: `HEAD → 520 → [delay] → HEAD → 200`
**Expected**: The caller receives the 200 response. One retry was performed.

---

#### `no-retry-post-520`
A POST request receives a 520 response.

**Stimulus**: `POST → 520`
**Expected**: The caller receives the 520 response immediately. No retry was performed.

---

#### `no-retry-get-404`
A GET request receives a 404 response.

**Stimulus**: `GET → 404`
**Expected**: The caller receives the 404 response immediately. No retry was performed.

---

#### `no-retry-abort`
A GET request is cancelled by the caller (AbortError or equivalent) before a response is received.

**Stimulus**: `GET → AbortError`
**Expected**: The AbortError is surfaced to the caller immediately. No retry was performed.

---

### Limit Scenarios

#### `retry-exhaustion`
A GET request receives a 520 response on every attempt.

**Stimulus**: `GET → 520 → [delay] → GET → 520 → [delay] → GET → 520 → [delay] → GET → 520`
**Expected**: The caller receives the last 520 response. Exactly 4 total attempts were made (1 initial + 3 retries).

---

#### `retry-recovers-before-exhaustion`
A GET request receives a 520 on the first two attempts, then a 200 on the third.

**Stimulus**: `GET → 520 → [delay] → GET → 520 → [delay] → GET → 200`
**Expected**: The caller receives the 200 response. 2 retries were performed. No further attempts were made.

---

### Delay Scenarios

#### `delay-increases`
A GET request receives a 520 three consecutive times.

**Stimulus**: `GET → 520 → [delay₁] → GET → 520 → [delay₂] → GET → 520 → [delay₃] → GET → 520`
**Expected**: The base delay (before jitter) satisfies `delay₁ < delay₂ < delay₃`. All base delays are > 0ms.

---

#### `delay-capped`
A GET request receives a 520 on every attempt.

**Stimulus**: Four total attempts with retryable responses between each.
**Expected**: No individual delay exceeds 30,000 ms (30 seconds).

---

#### `retry-after-respected`
A GET request receives a 503 response with `Retry-After: 5`.

**Stimulus**: `GET → 503 (Retry-After: 5) → [delay] → GET → 200`
**Expected**: The delay used before the retry is ≥ 5,000 ms (5 seconds). The caller receives the 200 response.

---

### 503 Scenarios

#### `retry-503-no-header`
A GET request receives a 503 response without a `Retry-After` header, then a 200.

**Stimulus**: `GET → 503 → [delay] → GET → 200`
**Expected**: The caller receives the 200 response. One retry was performed using the implementation's default delay.

---

#### `retry-503-with-header`
A GET request receives a 503 response with `Retry-After: 2`, then a 200.

**Stimulus**: `GET → 503 (Retry-After: 2) → [delay] → GET → 200`
**Expected**: The delay before the retry is ≥ 2,000 ms. The caller receives the 200 response.

---

### Network Error Scenarios

#### `retry-network-error-get`
A GET request throws a network error on the first attempt, then succeeds.

**Stimulus**: `GET → NetworkError → [delay] → GET → 200`
**Expected**: The caller receives the 200 response. One retry was performed.

---

#### `no-retry-network-error-post`
A POST request throws a network error.

**Stimulus**: `POST → NetworkError`
**Expected**: The network error is surfaced to the caller immediately. No retry was performed.

---

### Observability Scenarios

#### `x-retry-count-header`
A GET request is retried twice before succeeding.

**Stimulus**: `GET → 520 → [delay] → GET → 520 → [delay] → GET → 200`
**Expected**:
- Initial attempt: no `X-Retry-Count` header present
- First retry: `X-Retry-Count: 1`
- Second retry: `X-Retry-Count: 2`

---

### Configuration Scenarios

#### `retry-disabled-globally`
Retries are disabled at the client level. A GET request receives a 520.

**Stimulus**: `GET → 520` (retries globally disabled)
**Expected**: The caller receives the 520 response immediately. No retry was performed.

---

#### `retry-disabled-per-request`
Retries are enabled globally. A specific GET request has retries disabled. The request receives a 520.

**Stimulus**: `GET (retry: false) → 520` (retries globally enabled)
**Expected**: The caller receives the 520 response immediately. No retry was performed.

---

#### `retry-enabled-per-request-overrides-global`
Retries are disabled globally. A specific GET request has retries enabled. The request receives a 520, then a 200.

**Stimulus**: `GET (retry: true) → 520 → [delay] → GET → 200` (retries globally disabled)
**Expected**: The caller receives the 200 response. One retry was performed.

---

## Rationale

**Why only GET, HEAD, OPTIONS?** These HTTP methods are defined as safe and idempotent. Retrying a `POST`, `PATCH`, or `DELETE` risks duplicate side effects (e.g. double-inserting a row). Retrying non-idempotent methods would require server-side idempotency keys, which is out of scope for this spec.

**Why 520 and 503?** These are the two transient error codes observed in production PostgREST deployments. `520` is a Cloudflare-originated error indicating a connection-level transient failure. `503` from PostgREST typically indicates the schema cache is still being loaded. Both are conditions where an immediate retry has a high probability of succeeding.

**Why cap at 3 retries (4 total attempts)?** This balances resilience against excessive latency. With exponential backoff capped at 30 seconds, 3 retries can consume up to ~37 seconds in the worst case. More retries would make requests feel hung to end users.

**Why SHOULD for jitter rather than MUST?** Jitter is most valuable when many clients are retrying simultaneously, which is more common in server-side SDK usage. For client-side SDKs with a single user session, the benefit is lower. Leaving it as SHOULD allows implementations to ship without jitter and add it later without a spec version bump.

**Why `Retry-After` takes precedence?** The server has more information about when it will recover (e.g. PostgREST schema cache reload time). Respecting `Retry-After` avoids hammering the server during a known recovery window.

**Why not expose max retries as configuration?** Keeping configuration to a boolean (`enabled`/`disabled`) ensures a consistent user experience across all SDK languages and reduces the surface area for misconfiguration. SDK authors can revisit this in a future spec version if there is demonstrated user demand.

---

## Changelog

| Version | Date       | Description   |
| ------- | ---------- | ------------- |
| 0.1.0   | 2026-05-05 | Initial draft |
