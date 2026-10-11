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
Cost: Users see some listings with warnings.

## D-04 Find duplicates by matching key fields
Status: accepted
Context: The data has exact copies (1016/1059), reposts with a new price (1027/1084), and the same flat listed by two agents (1050/1111).
Decision: Group listings with the same normalized address, city, area, rooms, floor and offer type. The newest one is kept as the main listing; on the same date, the lowest id. The others get a `duplicateOf` field and are hidden from search results, but stay reachable by id. Listings whose address has no house number are never grouped.
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
Decision: A loop written directly on the Google Gen AI SDK, limited to 8 model calls. The loop talks to a small client interface; everything specific to Gemini sits in one adapter. Whatever the model does is treated as untrusted: an unknown tool, bad arguments or an invalid final answer is sent back to it as an error and the loop continues; invented or duplicate ids are removed from the result. Temporary provider errors (overloaded, short rate limits) are retried twice; a used-up daily quota is reported to the user as such. Temperature is 0 so runs are as repeatable as possible.
Alternatives: An agent framework (rejected: more abstraction to explain and debug, and this workflow does not need it). Another provider (any model with function calling would work; I used Gemini, and a second provider means one more adapter. I did not add adapters I could not test).
Cost: Tracing has to be added by hand if needed. Only one provider is supported today. One request makes about 4 to 8 model calls, which on a free tier is a hard limit on usage; I moved to a paid tier to run the evals. The limit was 6 at first; a request that loosens two constraints and inspects candidates used all 6, so I raised it.

## D-10 The agent returns IDs and reasons; the UI shows the facts
Status: accepted
Context: A model can misstate a number or mention a listing that does not exist.
Decision: The agent returns listing IDs, a reason for each, and its assumptions. The frontend loads those listings from the database and shows the real data.
Alternatives: Let the agent write the full answer as text, including prices and areas (rejected: there is no way to check it).
Cost: The answer is a structured shortlist, not a free conversation.

## D-11 MCP server over stdio, read-only tools
Status: accepted
Context: The task requires at least one capability exposed through MCP.
Decision: An MCP server over stdio with two tools: `search_listings` (at most 10 compact summaries plus the total) and `get_listing` (full details of one listing). The tools are defined once in `server/tools.ts` and used by both the MCP server and the agent. The server is registered in `.mcp.json`; I used it from Claude Code during development. When a search gets a city it does not know, the tool returns a hint listing the known cities, so a model can correct itself.
Alternatives: A remote HTTP transport (rejected: needs hosting and authentication). Tools that change data (rejected: there is no user need for them yet). More tools from the start, such as comparison and price statistics (deferred: two tools cover search, inspect and shortlist; a tool can be added later as one entry in the registry).
Cost: It only works for MCP clients on the same machine. The agent compares listings itself from their details, and cannot say how a price relates to the rest of the city.

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
Decision: The agent has a final tool, `submit_shortlist`, that it must call to return its shortlist, assumptions, loosened filters and warnings. The result is validated, and unknown or duplicate IDs are removed. On the last allowed step only this tool is offered and a call is required, so the agent cannot run out of steps without answering.
Alternatives: Reading JSON out of a text reply (rejected: breaks easily). Relying on the prompt alone to make it finish (rejected after a real run ended with "could not be completed").
Cost: If even the forced final answer is invalid, the user gets a "could not be completed" message.

## D-15 A missing price is valid, not a problem
Status: accepted
Context: Listing 1033 has no price and its description says "Price on request".
Decision: A null price gets no quality flag. The UI shows "Price on request". Such listings do not match when a price filter is set and sort last in price sorts.
Alternatives: Flag it as missing data (rejected: it would put a warning on a legitimate listing).
Cost: A price that is missing by mistake looks the same as one withheld on purpose.

## D-16 Values I do not trust do not decide ranking
Status: accepted
Context: Seen in the real API output. A listing dated in 2027 was first in the default "newest" sort, and a listing priced in EUR ranked among the cheapest as if it were PLN.
Decision: A listing with a future date sorts last in "newest". A non-PLN listing sorts last in price sorts, gets no price per m², and does not match price filters. A listing with an implausible area is left out of price-outlier detection. The listings stay visible and flagged in every case.
Alternatives: Hide them (rejected: hides real inventory over a metadata error). Convert the currency (rejected: needs an exchange rate source; left out, see below). Leave ranking as it was (rejected: the first thing a visitor saw was a listing with a wrong date).
Cost: A correctly scheduled future listing or a fairly priced EUR listing is ranked lower than it deserves.

## D-17 Reject invalid records instead of forcing them through
Status: accepted
Context: The first version of the normalizer used type casts on offer type and property type, so an unknown value such as "lease" would have been stored as if valid.
Decision: The normalized listing is validated with `ListingSchema` as the last step. A record that fails is rejected and reported by ingest with its id and the reason; the rest still load.
Alternatives: Cast or default unknown values (rejected: it is a silent guess). Stop the whole import on the first bad record (rejected: one bad record should not block the others).
Cost: A rejected listing is missing from the site until someone adds a rule or fixes the source.

## D-18 Different result limits for people and for models
Status: accepted
Context: The same search function serves the website and the tools.
Decision: The website gets all matches, like the original. The search tool returns at most 10 summaries plus the total, and the caller cannot raise that limit.
Alternatives: One limit for everyone (rejected: a person scrolling 97 cards is fine; a model receiving 97 listings per call is slow, costly and chooses worse).
Cost: The agent must narrow its search to see beyond the first 10.

## D-19 Show flags with the smallest possible UI change
Status: accepted
Context: Flags existed in the data and the API but nothing on screen showed them.
Decision: A "Check details" badge on cards with flags, and a "Things to verify" list on the detail page. The sentences shown to users come from a mapping in the frontend (`src/flagMessages.ts`), typed so a missing code fails the build. The messages stored with the data are written for developers and are not shown.
Alternatives: Leave flags to the assistant only (rejected: half of the data work would be invisible to someone browsing). A larger redesign with coloured warnings (rejected: not needed to make the point, and out of scope for the time).
Cost: The badge does not say what is wrong until the listing is opened.

## D-20 The agent's goal: from a vague request to a trustworthy shortlist
Status: accepted
Context: The brief asks for an agentic workflow with a meaningful goal. The starter's users cannot describe what they want in their own words, find offers hard to compare, and meet inconsistent data.
Decision: A search assistant. It takes a request in plain language and returns up to five listings, each with a reason, plus its assumptions, any constraints it loosened, and warnings where the data is flagged. It works in steps: interpret, search, loosen and search again if needed, inspect candidates, decide. When nothing fits it says so and names what the closest option costs.
Alternatives: A reviewer for flagged listings (useful, but serves the operations team rather than the person browsing). Structured intake of new listings (needs an intake flow that does not exist). A description rewriter (rejected: it would invent text about properties, against D-03).
Cost: It only helps with finding and comparing. It answers one request at a time, with no follow-up questions, and it does not act for the user.

## D-21 The agent must be honest about what the data confirms
Status: accepted
Context: On the first real run, asked for a flat for someone with a dog, the agent returned four listings and said all were suitable. Only one lists pets as allowed. It also added details that are not in the data.
Decision: Rules in the system prompt: a stated need becomes a feature filter in the first search; if that feature is dropped it is recorded as loosened, and each reason says whether the listing has it; only facts from the tool results; at most three searches; never drop the price limit, the city, the offer type or the property type. One extra search without the price limit is allowed only to report what the closest option costs.
Alternatives: Filter strictly and return only confirmed matches (rejected: one result is a poor shortlist, and "ask the owner about pets" is a useful answer when it is labelled as such).
Cost: These are prompt rules, so a model can still break them. The evals check the main ones.

## D-22 City names have aliases
Status: accepted
Context: A request for a house in Warsaw failed because the model searched for "Warszawa" and the data says "Warsaw". A person typing the Polish name into the search box would have hit the same thing.
Decision: City normalization maps known aliases (Warszawa, Cracow and others) to the canonical name. The search applies it to the city filter and to the free-text query.
Alternatives: Tell the model which names to use and leave the search as it was (rejected: it would fix the agent and leave the same problem for people).
Cost: The alias list is maintained by hand.

---

## Deliberately left out

- **Frontend framework:** kept vanilla TypeScript and spent the time on data, search and the agent.
- **Accounts and login:** not needed to find and compare listings.
- **Maps:** left out; the city filter and text search cover location for now.
- **District filter:** districts are matched by the text search; a dedicated select was cut for time.
- **Embeddings and vector search:** see D-08.
- **Comparison page and comparison tool:** the assistant compares listings from their details. See D-11.
- **Price statistics:** no "compared with the city median" figure in the UI or as a tool. Medians are only used internally to detect price outliers.
- **Currency conversion:** the one EUR listing is flagged, not converted.
- **Pagination:** not needed for about 100 listings; the website shows all matches.
- **Deployment:** the app runs locally.

## Known issues

- The feature checkboxes in the filter panel need layout polish.
- The one all-caps title is converted to lower case, which also lowercases the district name in it.
- The floor checks read English phrases in the description only.
- There is no "exactly N rooms" filter; rooms is a minimum. The agent leaves out larger results itself.
- The assistant takes several seconds per request and answers one request at a time.
- The assistant panel and the filter form are checked by hand; there are no browser tests.

## Future

- **Semantic search:** add embeddings alongside the filters when users start searching for things the filters cannot express.
- **Review queue:** let a person check flagged listings before they are published.
- **Grouped offers:** show one listing with both agents' contacts and the price history instead of hiding duplicates.
- **More tools:** a comparison tool and a price-statistics tool, added to the same registry.
- **Filters in SQL:** move city, price and rooms filters into SQL when the data grows (see D-13).
- **Pagination:** once the catalogue grows beyond a few hundred listings.
- **Remote MCP server:** a remote HTTP transport with authentication so a team can use it.
- **Exact room count:** a `maxRooms` filter.
- **More providers:** an OpenAI-compatible adapter would cover several providers with one implementation.
- **More agents:** a reviewer for flagged listings, and structured intake of new listings.
- **LLM-assisted audit:** use a model to propose new rule candidates from descriptions; the rules themselves stay deterministic.
- **Incremental ingest:** add or update single listings through the same normalization instead of a full rebuild.
- **Follow-up questions:** let the person refine a shortlist ("cheaper ones", "what about Podgórze").
- **Browser tests** for the assistant panel and the filters.

## Changes of mind

- **Backend and database (D-05, D-06):** I considered the simplest version: a cleaned JSON file searched in the browser, with a single server route for the agent. It would have worked for 100 listings. I chose the backend with SQLite because it gives one owner for the data and one search path for the UI, MCP and agent, and the extra cost was small.
- **Number of tools (D-11):** the first plan had four tools. I cut it to two to protect time for the agent and the evals, and kept the registry so more can be added without touching the MCP server or the agent.
- **`PRICE_MISSING` flag (D-15):** the first flag list treated a missing price as a problem. After looking at listing 1033 I removed the flag.
- **Ranking (D-16):** I first treated flags as display-only. Reading the real API output showed they also have to affect sorting.
- **Step limit (D-09):** 6 model calls looked generous. A real request used all 6, so it is now 8, with a forced answer on the last one (D-14).
- **Free tier (D-09):** I started on Gemini's free tier. Twenty requests per model per day is about three assistant questions, which cannot cover an eval run, so I moved to a paid tier.
- **Agent rules (D-21):** my first system prompt trusted the model to be careful about what it claimed. The first real run showed it was not, so the rules became explicit.