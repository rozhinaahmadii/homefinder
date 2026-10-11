# AI log

This is my running record of how I used AI on this project: what I asked for, where it got things wrong, and what I did about it. I kept some of the real prompts so I can explain them.

## How I worked

- **Claude Code** in the terminal wrote most of the code, one small task at a time.
- **A separate Claude chat** helped me plan the steps and review output before I accepted it.
- **Gemini** (free tier) is the model inside the app's assistant.
- `CLAUDE.md` holds the project rules. `docs/DECISIONS.md` holds my decisions.

My loop for every step: ask for a plan or the tests first, read it, let it implement, run `npm run check`, read the diff, then run the real thing and look at the output myself.

Every new Claude Code session started with this:

> Read CLAUDE.md and docs/DECISIONS.md. Then look at src/core, server and scripts. Summarise in 6 lines what is already built and what is not. Do not change anything.

If the summary was wrong, I fixed the context file, not the chat.

---

## Step 1: looking at the data first

I didn't want to fix anything before I knew what was broken, so I asked for a script that only reads the data and reports problems.

The prompt (shortened):

> Write scripts/audit.ts. It reads data/listings.raw.json and runs a read-only audit: field types, distinct values for city / offerType / propertyType / currency / features, non-numeric price / area / rooms / floor, contradictions between fields and the description, bad dates, missing images, price per m² outliers, duplicates. End with a table of issues and listing IDs. The examples I give illustrate the kind of problem; use general rules, do not hardcode listing IDs. One file, no new dependencies. Strictly read-only.

What went wrong:

- It suggested removing "elevator" from listing 1055 because the description says there's no lift. But nobody knows which one is wrong. I kept both and flagged it.
- It told me the summary table covered everything. It didn't: city spellings, "Sale" / "flat", the EUR listing, the Polish feature names and the text id were all missing. I added them.
- It missed listing 1112, where the floor is the word "parter" but the description says floor 4.
- Its suggested rules used one generic "quality_issue". I replaced that with specific codes so the UI and the assistant can say what is actually wrong.

Later I removed the script's "suggested rule" column completely, because it disagreed with what I had decided in `docs/DATA_AUDIT.md`.

## Steps 2 and 3: types and cleaning rules

I did the cleaning in small rounds: simple parsers first (price, area, rooms, floor, date), then vocabularies (city, offer type, features, title, address), then the whole listing with its quality flags, then price outliers. Tests first every time, using real dirty values from the file.

What went wrong:

- **It used type casts on outside data**, even though `CLAUDE.md` says not to. A listing with offer type "lease" would have been stored as if it were valid. I had it validate the finished listing with the schema instead, so bad records get rejected.
- **It quietly skipped two things I asked for** (reject unknown values, and don't flag a missing price). The tests still passed. I only saw it because I compared the diff with my prompt.
- **`parseDate` accepted 31 February.** I found that by adding an edge-case test.
- **The ground-floor check never matched** how the descriptions are actually written.

The fix prompt I used:

> Fix these in src/core/normalize.ts, tests first for each:
> 1. Remove the two `as` casts in normalizeListing. Build the object, then return ListingSchema.parse(...) so an unknown offerType or propertyType throws.
> 2. Remove the PRICE_MISSING flag. A null price is valid ("Price on request").
> 3. parseDate returns null for impossible dates such as "31/02/2026".
> 4. Set image to null when it is empty or the file does not exist; flag IMAGE_MISSING.
> 5. The ground-floor check must also match "ground floor apartment" at the start of a sentence.

Two tests I added on purpose: listing 1045 keeps its price of 5,950,000 after cleaning (flagging never changes a value), and listing 1018 gets "PLN" from its price text.

My own mistake here: I pasted the next prompt while Claude was waiting for me to approve tests, and it started building on things that didn't exist yet. I stopped it and went back in order.

## Step 4: duplicates

Before looking at the tests I wrote down which listing should win in each pair (1059, 1084, 1050), then checked the tests against that. I added one test it didn't have: a duplicate must also be left out of the median, not just out of the flagging.

## Step 5: database and ingest

Claude's summary said 16 listings were flagged and "everything matches the audit". I had the expected IDs per flag ready, and the real output shows 15. The pipeline was right; the summary was miscounted. Since then I read the command output, not the description of it.

## Step 6: search

What went wrong:

- **Sorting high to low put "Price on request" first.** To sort descending it swapped the two arguments, which also flipped the "missing values go last" logic. Its own test passed because the loop in it ran zero times. I found it by reading the code, and made the tests check that the list isn't empty.
- **With auto-accept on it skipped "show me the tests first"** and left a default limit of 50, when I had decided the website shows everything.
- **The feature filter only matched exact words.** "Lift" found nothing although the data says "elevator".

## Step 7: API

I worked out one answer by hand from the raw data (Kraków, sale, 2+ rooms, up to 800k = five listings) and compared it with the API. It matched.

Reading the full API output showed two things no test had covered:

- A listing dated in 2027 was first in the default "newest" sort.
- A listing priced in EUR was ranked as if it were PLN, so it looked like a bargain.

Neither was a bug against my prompt. They only showed up once real data went through the whole thing. I fixed both: data I don't trust doesn't get to decide ranking.

## Step 8: frontend

Two prompts with a check in between: first switch the page to the API with no visual changes, then show the quality flags with the smallest possible change (a "Check details" badge and a "Things to verify" box).

- I asked for the plan first and capped it at about ten CSS lines. The plan put the warning list inside a box that is a multi-column grid, which would have squeezed it into one narrow column. Fixing that cost one sentence because nothing was written yet.
- Two of the "expected results" I had prepared beforehand were wrong ("balcony Mokotów" correctly returns nothing; the top of the price sort is the flagged 5.95M listing). The app was right. I checked against the data.

## Step 9: tools

Two tools, defined once: `search_listings` (max 10 short summaries plus the total) and `get_listing`.

- Two proposed tests couldn't fail: "at most 10 results" with only 5 listings in the test data, and "flags come back as codes" with no flagged listing in it. I had it use more listings and a flagged one.
- When I ran the tool by hand, four fields I had asked for were missing from the summaries. The test didn't check the exact fields. Now it does.
- Claude got stuck retrying shell commands that don't work on Windows. I stopped it, gave it the facts it was trying to look up, and added a Windows note to `CLAUDE.md`.
- The tool descriptions were drafted with AI help and I went through each sentence, because the description is all a model reads when deciding how to use a tool.

## Cleanup before Step 10

A fresh session, with only the orientation prompt, noticed the code had drifted from my own rules: SQL outside `db.ts`, and casts on outside data. I asked it to list every cast and say whether it's validated right after. Most were fine. One was a real bug: ingest read a record's id outside its error handling, so one `null` record would have stopped the whole import. No test caught it because the real file has no null record. Fixed, with a test. The real data still gives 100 read, 100 stored, 0 rejected, 3 duplicates.

What I took from it: a long session lets small rule breaks slip in, and the context file is good enough for a new session to catch them.

## Step 10: MCP server

The server just passes on the two tools; it has no logic of its own. To test it for real I connected it to Claude Code and asked:

> Use the homefinder tools to find 2-room flats for sale in Kraków under 800,000 PLN, then look at the two cheapest in detail and tell me which you would pick and why. Mention anything I should verify.

With no other instructions it searched with the right filters, saw one result had a flag, opened the two cheapest, and recommended 1101 over the cheaper 1067 because 1067 says 23.1 m² in one place and 37 m² in another.

So a flag I added on day one changed what a model recommended. That's the link between the data work and the AI part.

Two things I learned from that run:

- There's no "exactly 2 rooms" filter. The model dropped the 3-room result by itself. It's on my next-steps list.
- It noticed something my rules don't check: the same description says "separate kitchen" and "open kitchen". Rules catch the problems I already know about; a model reading the text can spot new ones.

## Step 11: the agent

A loop: the model can call my two tools and has to finish by calling `submit_shortlist`. There's a limit on the number of model calls, and the model client is passed in so the tests use a fake model and never call the real API.

Things I can explain about the design:

- The loop never trusts the model. An unknown tool, bad arguments or an invalid final answer is sent back to it as an error. Made-up or duplicate ids are removed.
- The flag codes in the answer come from my database, not from the model.
- Everything Gemini-specific sits in one small adapter.

**First real run.** I asked: "2 rooms in Krakow to buy, under 800k, I have a dog". It returned four listings and said all of them suit a dog. Only one lists pets as allowed. It never used the pets filter, didn't say it had dropped anything, and added details that aren't in the data ("green walking areas").

**What I changed in the system prompt:**

- something the person needs (a dog, a car) becomes a feature filter in the first search
- if a requested feature is dropped, that has to be recorded, and each reason has to say whether the listing has it
- only facts that are in the tool results
- look at up to 3 candidates, not all of them

I also set the temperature to 0 so the same question gives nearly the same answer each time.

**Same question after the change.** It searched with "pets allowed" (one match), tried a 15% higher budget (still one), then dropped the pets filter and said so. One listing is described as confirmed pet-friendly; the others say pets need to be checked. No invented details.

That run used exactly as many model calls as my limit allowed, so I raised the limit from 6 to 8.

One rule in the system prompt comes straight from the MCP test: "rooms is a minimum; if the person asks for an exact number, leave out bigger ones".

## Step 12: evals

Nine scenarios in evals/scenarios.json. Each one is a realistic request plus rules
the answer has to meet. The rules are checked by code against the database, not by
another model. Some rules apply to every scenario: the ids are real and not
duplicates, at most five listings, any flagged listing is named in a warning, and
the agent actually finished.

Most scenarios come from things that went wrong when I tested by hand: the dog
question, the Warsaw house, the cheapest flat in Warsaw.

**First full run:** 8 of 9 passed, 35 model calls.

**What failed, and what passed but should not have:**

- `polish-city-name` (failed): a request in Polish returned nothing. I guessed the
  agent had passed the city in its inflected form. The trace showed it searched for
  "Warszawa" every time and followed the loosening rules correctly, but every
  search came back empty. Cause: search code. The city alias fix I thought I had
  made earlier was never applied. Fixed in the search (aliases, including the
  Polish forms used after "w") and in the tool (a hint listing the known cities).

- `suspicious-price` (passed with a poor answer): "the cheapest flat to buy in
  Warsaw" left out the two cheapest unflagged listings, both studios, because the
  agent filtered on property type "apartment". My rules did not catch it. I changed
  the system prompt ("flat" includes studios), made the scenario require listing
  1060, and added a `mustInclude` check to the grader.

**After the fixes:** 9 of 9, 31 model calls, on gemini-3.6-flash.
Results are in docs/EVAL_RESULTS.md.

**What I take from it:**
- The eval caught a fix I believed was already done.
- A passing eval only means the answer met the rules I wrote. I still read the answers.
- I read the trace before changing anything; my first guess was wrong again.
- What the checks cannot see: whether the written reasons are good, and whether a
  different shortlist would have been better.
  
### Testing the assistant in the browser

I tried three requests in the panel.

1. **"Write me a poem"**: it returned no listings and a message saying what it can help with. That is the behaviour I wanted for off-topic requests.

2. **"2 rooms in Krakow to buy, under 800k, I have a dog"**: three listings, shown as the normal cards with real data from the database. The message says only the first one confirms pets, a "Loosened" line says the pet filter was dropped to find more results, and the reason under each card says whether pets are confirmed. This is the same question that overclaimed on the first run, now answering honestly.

3. **"House with garden in Warsaw under 1 million"**: it ended with "could not be completed". I assumed the agent was looping. The trace showed the real cause: the model searched for "Warszawa" and my data says "Warsaw", so every search returned nothing, and it kept loosening filters until it ran out of steps. It was a search bug that would also hit a person typing the Polish name. I fixed it in three places:
   - the search now understands city aliases (Warszawa, Cracow and so on)
   - the search tool returns a hint listing the known cities when it gets one it does not know
   - the agent's last step is a forced answer, so it can never end without one

   I also limited it to three searches and stopped it from dropping the price limit or the property type, which it did in that trace although my rules never allowed it.
   After the fixes it answers in a few steps: no houses in Warsaw under 1 million, and the closest is the one in Ursynów at 1.72 million. I added a rule that lets it make one extra search without the price limit only to report what the closest option costs.

**Two provider problems on the way:** a 503 from Gemini (overloaded) and then a 429 (free-tier daily quota: 20 requests per model per day, about three assistant questions).Added Billing.

What I take from this: read the trace before blaming the model. My first guess about test 3 was wrong.

## Step 12: evals

Nine scenarios in evals/scenarios.json. Each is a realistic request plus rules the
answer has to meet. The rules are checked by code against the database, not by
another model. Some rules apply to every scenario: the ids are real and not
duplicates, at most five listings, any flagged listing is named in a warning,
and the agent actually finished.

Most scenarios come from things that went wrong when I tested by hand: the dog
question (overclaiming), the Warsaw house (Polish city name), the cheapest flat
in Warsaw (a listing with a suspicious price).

**First run:** X of 9 passed.

**What failed and why:**

- `<scenario id>`: what the agent did. Cause: [system prompt / tool description /
  search code / my expectation was wrong]. What I changed.
- ...

**After the fixes:** X of 9 passed, about N model calls for the full run, on
<model id>.

**What I noticed:** [anything that passed once and failed once; anything the
checks cannot see]

## What I learned about working this way

- Passing tests don't prove the instruction was followed. I compare the diff with what I asked for.
- "Covers everything" and "all matching" are claims. I check the real output.
- A test that loops over a list can pass by checking nothing. I make sure the list isn't empty.
- If a suggestion guesses a value (remove a feature, fix a price), I turn it into a flag instead.
- Writing down what I expect before I run something makes wrong output obvious. Sometimes it's my expectation that's wrong.
- Asking for the plan before the edit is the cheapest place to catch a problem.
- When the agent loops on something that keeps failing, I stop it and give it the missing fact.
- I start a new session for each big step. Long sessions get worse.
- The first real run of anything with a model in it will be wrong in some way. That's what the evals are for.