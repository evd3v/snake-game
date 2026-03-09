# Phase 1: Foundation and Data Layer - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Running development environment with PostgreSQL database (schema for sentences, words, collocations, grammar patterns, word families, SRS cards), Fastify API skeleton, BullMQ job queue, and Docker Compose setup. No business logic — only infrastructure ready to accept domain code in Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User delegated all implementation decisions to best practices. Claude has full flexibility on:

**Project structure:**
- Monorepo vs separate packages
- Folder organization and naming conventions
- Shared types/utilities approach

**Data model:**
- Table relationships for word families, collocations, grammar patterns
- Grammar pattern storage (flat vs hierarchical)
- Thematic cluster modeling
- Index strategy

**API contract:**
- Response format (envelope vs flat)
- Error format and status codes
- Endpoint naming and structure
- Validation approach

**Docker and environment:**
- Dev vs prod configurations
- Hot reload setup
- Environment variables structure
- Service health checks

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants best practices throughout.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes the patterns

### Integration Points
- PostgreSQL + Drizzle ORM (INFRA-01)
- Fastify REST API in TypeScript (INFRA-02)
- Docker Compose for dev environment (INFRA-05)
- BullMQ + Redis for async AI processing (INFRA-06)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-data-layer*
*Context gathered: 2026-03-09*
