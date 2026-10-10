# Decisions

A running log of choices made during this exercise. One entry per decision, written at the moment it is made. Entries are short on purpose: what, why, what was rejected, and what it costs.

Status values: `accepted`, `changed` (link to the entry that replaced it), `dropped`.

---

## D-01 Prioritise data trust, forgiving search, then the assistant
Status: accepted | Date: 2026-10-10
Context: The starter codebase has dirty data, brittle search and no way to express vague intent or compare offers.
Decision: Fix data first, because every other feature (filters, price per m², agent answers) is wrong on top of bad data. Then search, then the assistant.
Alternatives: Start with the AI feature for demo value. Rejected: an agent recommending a listing with a mistyped price is worse than no agent.
Cost: Less time for UI polish and more features.

## D-02 Normalize deterministically at ingest, not with an LLM and not at runtime
Status: proposed | Date: 2026-10-10
Context: Prices, areas, cities, enums and dates arrive in mixed formats.
Decision: A one-off ingest script with Zod and explicit parsing rules, each covered by a test.
Alternatives: LLM-based cleaning (non-deterministic, untestable, costs money per run). Cleaning in the browser (repeats on every load, hides the problem).
Cost: New dirty formats need a new rule. Acceptable at this size; see Future.

## D-03 Flag implausible values instead of correcting them
Status: proposed | Date: 2026-10-10
Context: Some values are probably wrong but the right value is a guess (e.g. 1045 price, 1019 sale priced like a rent, 1113 area of 3.45 m²).
Decision: Keep the raw value, attach a quality flag, show a warning in the UI and pass it to the agent.
Alternatives: Auto-correct (a wrong guess on a price is a product liability). Drop the listing (hides inventory).
Cost: Users see imperfect listings. Flagged listings are excluded from statistics such as median price per m².

## D-04 Duplicate handling
Status: proposed | Date: 2026-10-10
Context: Three kinds of duplicates: exact copy (1016/1059), repost with a new price (1027/1084), same flat from two agents (1050/1111).
Decision: Cluster on normalized address + area + rooms + floor + offer type. Keep the newest as canonical, mark the rest with `duplicateOf`, hide them from results.
Alternatives: Delete duplicates (loses information). Show all (clutters results, skews stats).
Cost: The second agent's contact is hidden for now. Grouped offers are listed as future work.

## D-05 Add a small backend
Status: proposed | Date: 2026-10-10
Context: The starter is static. The assistant needs an LLM key, and the MCP server is a Node process regardless.
Decision: One small Node server (Hono) serving the API and the agent endpoint.
Alternatives: Stay fully static (key would be exposed in the browser; search logic would be duplicated between browser and MCP server).
Cost: The app is no longer deployable as static files only.

## D-06 Storage: SQLite, no ORM
Status: proposed | Date: 2026-10-10
Context: ~100 listings. The brief hints a database could be useful.
Decision: A SQLite file (better-sqlite3) written by the ingest script and rebuilt on every run. All SQL lives in `server/db.ts`. The original record is kept in a `raw` column for traceability.
Alternatives: Postgres (needs infrastructure, no benefit at this size). A static normalized JSON file searched in the browser (simplest thing that works at 100 listings, but the data would be loaded separately by the UI, the MCP server and the agent, with no single owner). An ORM (more to explain than the handful of queries it would replace).
Cost: Reviewers must run `npm run ingest` once. The app can no longer be hosted as static files.

## D-07 One search core shared by UI, MCP and agent
Status: proposed | Date: 2026-10-10
Context: Three consumers need the same search behaviour.
Decision: A single pure function in `src/core/search.ts`; tools are defined once and registered in both the MCP server and the agent.
Alternatives: Separate implementations per consumer (they drift, and evals stop reflecting what users see).
Cost: The frontend depends on the API for search.

## D-08 No embeddings or vector search
Status: proposed | Date: 2026-10-10
Context: Users express vague intent ("something quiet for a couple with a dog").
Decision: The LLM translates intent into structured filters; retrieval stays structured.
Alternatives: Embeddings/RAG. Rejected at 100 structured listings: filters are exact, explainable and testable; semantic retrieval adds infrastructure and fuzziness for no recall gain.
Cost: Purely descriptive intent ("charming") relies on keyword match in descriptions.

## D-09 Agent as a plain tool-use loop, no framework
Status: proposed | Date: 2026-10-10
Context: The workflow is short: interpret, search, relax if needed, compare, answer.
Decision: A hand-written loop with a step cap and typed tools.
Alternatives: An agent framework (more to explain, harder to debug, nothing here needs it).
Cost: No built-in tracing or retries. Listed as future work.

## D-10 Agent returns IDs and reasoning; UI renders facts
Status: proposed | Date: 2026-10-10
Context: A model can misstate a price or invent a listing.
Decision: Structured output with listing IDs, a reason per listing, stated assumptions and warnings. IDs are validated against the store before rendering.
Alternatives: Free-text answers (unverifiable).
Cost: Less conversational output.

## D-11 MCP over stdio, read-only tools
Status: proposed | Date: 2026-10-10
Context: The brief requires at least one capability exposed through MCP.
Decision: `search_listings`, `get_listing`, `compare_listings`, `market_stats` over stdio, registered in `.mcp.json` so it is usable from Claude Code during development.
Alternatives: Remote HTTP transport (needs auth and hosting). Write tools (no user need yet, higher risk).
Cost: Local use only.

## D-12 Evals: scenario file with deterministic assertions
Status: proposed | Date: 2026-10-10
Context: Agent behaviour needs a lightweight check.
Decision: About ten scenarios in JSON; assertions on returned IDs, constraint satisfaction and required warnings; one command prints the pass rate.
Alternatives: LLM-as-judge (slower, noisier, not needed for ID-level checks).
Cost: Does not measure the quality of the written reasoning.

## D-13 Search filters in memory through a pure function, not in SQL
Status: proposed | Date: 2026-10-10
Context: The data is in SQLite, so filtering could be done with WHERE clauses.
Decision: `server/db.ts` loads listings and `src/core/search.ts` filters and sorts them as a pure function.
Alternatives: SQL filtering (faster at scale, but text matching with diacritics and feature lists is awkward in SQLite, and the logic would be split between SQL and code).
Cost: Every search reads all rows. Fine at 100 listings; structured filters move into SQL when the data grows.

## D-14 Agent finishes through a `submit_shortlist` tool
Status: proposed | Date: 2026-10-10
Context: The UI needs structured output it can validate, not free text.
Decision: The loop ends when the model calls `submit_shortlist` with IDs, reasons, assumptions, relaxed constraints and warnings. The result is validated with Zod and unknown or duplicate IDs are dropped.
Alternatives: Parsing JSON out of a text reply (brittle). A second model call to format the answer (extra cost and latency).
Cost: If the model never calls the tool, the step cap returns an empty result with an explanation.

---

## Deliberately left out

- TODO: item, and one line on why.

## Future

- TODO: item, and what would trigger doing it.

## Changes of mind

Record here when a decision above was reversed, and what was learned. Reviewers value this more than a clean record.
