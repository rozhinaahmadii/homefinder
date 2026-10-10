# Decisions

A running log of choices made during this exercise. One entry per decision, written when it is made. Each entry says what I chose, why, what I rejected, and what it costs.

Status values: `accepted`, `changed` (link to the entry that replaced it), `dropped`.

---

## D-01 Fix the data first, then search, then the assistant
Status: accepted
Context: The starter has dirty data, a search that only matches exact substrings, and no way to describe what you want in your own words or to compare offers.
Decision: Clean the data first, then make search more forgiving, then build the assistant on top.
Alternatives: Start with the assistant because it demos well. Rejected: an assistant that recommends a listing with a broken price is worse than no assistant.
Cost: Less time for visual polish.

## D-02 Clean the data once, at ingest, with fixed rules
Status: accepted
Context: Prices, floors, rooms and areas arrive as a mix of numbers, text and missing values.
Decision: An ingest script with Zod validation and explicit parsing rules. Each rule has a unit test.
Alternatives: Cleaning with an LLM (rejected: results can differ between runs, it is hard to test, and it costs money on every run). Cleaning in the browser (rejected: repeats the work on every page load and hides the problem instead of fixing it).
Cost: A new kind of dirty value needs a new rule.

## D-03 Flag doubtful values instead of guessing the right one
Status: accepted
Context: Some values are probably wrong, but the correct value would be a guess. Examples: listing 1045 (5.95M PLN for 71 m² in Łódź), listing 1019 (a sale priced at 4,500 PLN), listing 1113 (3.45 m²).
Decision: Keep the original value, attach a quality flag, show a warning in the UI, and pass the flag to the agent.
Alternatives: Correct the value automatically (rejected: a wrong guess on a price misleads users). Remove the listing (rejected: hides real inventory).
Cost: Users see some listings with warnings. Flagged listings are left out of market statistics.

## D-04 Find duplicates by matching key fields
Status: accepted
Context: The data has exact copies (1016/1059), reposts with a new price (1027/1084), and the same flat listed by two agents (1050/1111).
Decision: Group listings with the same normalized address, city, area, rooms, floor and offer type. The newest one is kept as the main listing. The others get a `duplicateOf` field and are hidden from search results.
Alternatives: Delete duplicates (rejected: loses the second agent's contact and the record of what was in the data).
Cost: The second agent's contact is not shown for now.

## D-05 Add a small backend (Hono)
Status: accepted
Context: The starter is a static site. The assistant needs an LLM API key, and the MCP server is a Node process anyway.
Decision: A small Node server using Hono. It serves the listings API and runs the agent.
Alternatives: Stay fully static (rejected: the API key would be visible in the browser, and search would have to be written twice, once for the browser and once for the MCP server). Express would also work; I chose Hono because it is smaller and typed out of the box.
Cost: The app needs a running Node process and can no longer be hosted as static files only.

## D-06 Storage: SQLite, no ORM
Status: accepted
Context: About 100 listings. The brief mentions a database could be useful.
Decision: A SQLite file (`data/homefinder.db`) created by `npm run ingest` and rebuilt on every run. The original record is kept in a `raw` column so any value can be traced back. All SQL is in `server/db.ts`.
Alternatives: Postgres (rejected: needs extra setup for reviewers and gives no benefit at this size). A clean JSON file (rejected: the UI, the MCP server and the agent would each load the data separately). An ORM (rejected: more to explain than the few queries it would replace).
Cost: Reviewers must run `npm run ingest` once before starting the app.

## D-07 One search function for the UI, the MCP server and the agent
Status: accepted
Context: All three need the same search behaviour.
Decision: One pure function in `src/core/search.ts`. Everything calls it.
Alternatives: A separate search per consumer (rejected: they drift apart, and then the evals test something different from what users see).
Cost: The frontend depends on the API for search instead of filtering locally.

## D-08 Structured filters, no embeddings or RAG
Status: accepted
Context: Users describe what they want loosely, for example "something quiet for a couple with a dog".
Decision: The LLM turns the request into filters (city, rooms, budget, features). The search itself stays exact.
Alternatives: Embeddings and a vector store (rejected: with about 100 structured listings, exact filters are precise, explainable and testable. Embeddings would add approximate matches, extra dependencies and latency without finding more relevant listings).
Cost: Vague words like "sunny" or "cosy" only match if they appear in the description.

## D-09 Agent as a hand-written tool loop, no framework
Status: accepted
Context: The workflow is short: understand the request, search, loosen filters if there are too few results, compare, answer.
Decision: A loop written directly on the Anthropic SDK, limited to 6 steps.
Alternatives: An agent framework (rejected: more abstraction to explain and debug, and this workflow does not need it).
Cost: Tracing and retries have to be added by hand if needed.

## D-10 The agent returns IDs and reasons; the UI shows the facts
Status: accepted
Context: A model can misstate a number or mention a listing that does not exist.
Decision: The agent returns listing IDs, a reason for each, and its assumptions. The frontend loads those listings from the database and shows the real data.
Alternatives: Let the agent write the full answer as text, including prices and areas (rejected: there is no way to check it).
Cost: The answer is a structured shortlist, not a free conversation.

## D-11 MCP server over stdio, read-only tools
Status: accepted
Context: The task requires at least one capability exposed through MCP.
Decision: An MCP server over stdio with four tools: `search_listings`, `get_listing`, `compare_listings`, `market_stats`. It is registered in `.mcp.json`, so I also used it from Claude Code during development.
Alternatives: A remote HTTP transport (rejected: needs hosting and authentication). Tools that change data (rejected: there is no user need for them yet).
Cost: It only works for MCP clients on the same machine.

## D-12 Scenario-based evals with rule-based checks
Status: accepted
Context: The agent's behaviour needs a simple, repeatable check.
Decision: A file of scenarios (`evals/scenarios.json`), each with a query and expected results. `evals/run.ts` runs them and checks returned IDs, whether results match the constraints, and whether required warnings are present.
Alternatives: Using an LLM to grade the answers (rejected: slower and less consistent, and not needed to check IDs and constraints).
Cost: It does not judge the quality of the written explanation. Agent output varies between runs, so a scenario can pass once and fail once.

## D-13 Search runs in memory, not in SQL
Status: accepted
Context: The data is in SQLite, so filtering could be done in SQL. But text matching has to ignore Polish diacritics, and features are stored as a list.
Decision: The server loads the listings and `src/core/search.ts` filters and sorts them in code.
Alternatives: Filtering in SQL (rejected for now: diacritic-insensitive matching and list filters are awkward in SQLite, and the logic would be split between SQL and TypeScript).
Cost: Every search reads all rows. Fine for 100 listings. With much more data, the simple filters (city, price, rooms) should move into SQL.

## D-14 The agent finishes by calling `submit_shortlist`
Status: accepted
Context: The UI needs structured data it can validate, not free text.
Decision: The agent has a final tool, `submit_shortlist`, that it must call to return its shortlist, assumptions, loosened filters and warnings. The result is validated, and unknown or duplicate IDs are removed.
Alternatives: Reading JSON out of a text reply (rejected: breaks easily).
Cost: If the agent reaches the step limit without calling the tool, the user gets an empty result with an explanation.

---

## Deliberately left out

- **Frontend framework:** kept vanilla TypeScript and spent the time on data, search and the agent.
- **Accounts and login:** not needed to find and compare listings.
- **Maps:** left out; city and district filters cover location for now.
- **Embeddings and vector search:** see D-08.
- **Dedicated compare page:** comparison is available through the assistant and the MCP tool only.
- **Currency conversion:** the one EUR listing is flagged, not converted.
- **Pagination:** not needed for about 100 listings.
- **Deployment:** the app runs locally.

## Future

- **Semantic search:** add embeddings alongside the filters when users start searching for things the filters cannot express.
- **Review queue:** let a person check flagged listings before they are published.
- **Grouped offers:** show one listing with both agents' contacts and the price history instead of hiding duplicates.
- **Filters in SQL:** move city, price and rooms filters into SQL when the data grows (see D-13).
- **Remote MCP server:** a remote HTTP transport with authentication so a team can use it.

## Changes of mind

- **Backend and database (D-05, D-06):** I considered the simplest version: a cleaned JSON file searched in the browser, with a single server route for the agent. It would have worked for 100 listings. I chose the backend with SQLite because it gives one owner for the data and one search path for the UI, MCP and agent, and the extra cost was small.