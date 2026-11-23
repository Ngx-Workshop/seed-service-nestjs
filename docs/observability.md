# Service logging and heartbeat

## Local pipeline and access

Native NestJS 11 `ConsoleLogger` emits JSON to stdout/stderr. Contextual `Logger`
calls reuse it; no application-held Grafana credential/SDK or replacement
collector is introduced. CRUD routes remain unguarded demonstrations; only
`/example-crud/auth-test` uses RemoteAuthGuard. Logging is not authorization.

GET/HEAD `/health` is anonymous Terminus liveness (`status: ok`, `heartbeat: up`),
with `Cache-Control: no-store`, excluded from Swagger and access logs. It does
not claim MongoDB/upstream readiness. Docker probes every 30 seconds; deployment
retains bounded JSON files of 10 MiB x 3.

HTTP events contain method, route template (or `/unmatched`), status, duration
and request ID. They never include bodies, cookies, authorization, raw paths or
queries. A single incoming `X-Request-ID` is accepted only as a canonical UUID
v4 (case normalized); invalid/multiple values are replaced with a local UUID.
The response echoes this safe ID. GET/HEAD health bypasses ID/context setup too.

## Domain outcomes and correlation

`ExampleCrudService` emits one `example_crud_operation` outcome for create,
find_all, find_one, find_by_name, update, remove, archive and unarchive. Archive
uses the private persistence operation, so it does not also emit update. There
are no per-record events or redundant auth-test events.

Success uses level `log`; expected not-found/conflict uses `warn`; storage
failures use `error`. Fields are operation, outcome, rounded durationMs,
random operationId, and requestId when called from HTTP. Failures include only
bounded reason (`not_found`, `conflict`, `storage_failure`) and statusCode, never
exception text/stack, names, document IDs, description/address or result payload.
Failures are rethrown with existing HTTP mapping; logging does not mask errors.
The existing HTTP access outcome remains separate from the domain outcome.

ObservabilityModule exports a singleton RequestContext backed by
AsyncLocalStorage, explicitly imported by the example module. Middleware runs
the async request in that context, including storage waits. Concurrent requests
remain isolated. Work started outside HTTP gets an operationId but no fabricated
requestId. Async work deliberately spawned within a request inherits context;
this is not a job scheduler or automatic cross-service tracing. No upstream
request header forwarding is added to the external auth client.

Native Nest output places domain fields under **message**, not at top level:

```json
{
  "level": "log",
  "context": "ExampleCrudService",
  "message": {
    "event": "example_crud_operation",
    "operation": "archive",
    "operationId": "1b301c13-d28a-48c2-991f-a3b4e2dd7de1",
    "requestId": "8b023f71-5d98-44df-af38-9b2d7dbf2ee4",
    "outcome": "success",
    "durationMs": 4
  }
}
```

The native logger also supplies its existing timestamp/pid fields. In Loki,
select the infrastructure owner's actual service stream labels, then use:

```logql
{service_name="seed-service-nestjs"}
  | json event="message.event", operation="message.operation", outcome="message.outcome", requestId="message.requestId"
  | event="example_crud_operation"
  | outcome="failure"
```

For request correlation, omit the event filter and filter parsed requestId.
IDs remain JSON fields, never high-cardinality indexed Loki labels. Confirm the
collector's actual stream label name before using this illustrative selector.
Sanitization guarantees here cover our HTTP/domain events, not arbitrary logs
from third-party providers or Nest's unchanged default exception handler.

## Verification and external owner

On 2026-11-22, local Node 22 checks passed: 15 unit/observability tests and 12
isolated HTTP cases, including native success/failure JSON field placement,
canary-content exclusion, UUID validation, concurrent context isolation,
background operation IDs, quiet health/HEAD and HTTP/domain correlation.
These are not MongoDB/auth-service integration tests or live Grafana evidence.

Infrastructure owner `nginx-ngx-workshop.io/ops/grafana` owns Alloy discovery,
private heartbeat metrics, dashboard and write-only ingestion credentials for
stack `ivorytoffee195`. Live ingestion authorization/receipt remains pending;
no collector source or credentials were required for local work. Owner next
check: authorize host ingestion, deploy through the approved release process,
exercise a success and failure, locate both JSON messages and one matching
requestId in Loki, verify health polls stay quiet and labels remain bounded.
No deployment/publication was performed by this maintenance.
