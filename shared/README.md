# shared

Versioned API contracts (request/response types, schema) shared by backend and client so they never drift.

**Frozen before the multi-agent fan-out.** Never edited from a module agent; if a contract changes, the fan-out stops and re-syncs (SPEC §13.0.4).
