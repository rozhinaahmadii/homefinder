# Data Audit Findings & Normalization Rules

## How the pipeline works

`npm run ingest` runs the pipeline once, from the raw JSON to the database:

1. Read the raw file.
2. Check each record’s shape/RawListingSchema
3. Normalize, and reject anything that still isn’t valid.
4. Mark duplicates.
5. Flag price outliers.
6. Write everything in one transaction.
7. Print a summary.

## Findings and rules

Run audit: `npx tsx scripts/audit.ts`

| Issue | Listing IDs | Rule |
|---|---|---|
| Price as text | 1005, 1011, 1018, 1075 | Fix: parse to clean number at ingest |
| Price null | 1033 | Keep null, render "Price on request" (valid inventory, not an error) |
| Currency missing but embedded in price text | 1018 | Fix: extract PLN from price string |
| Currency EUR | 1095 | Flag `CURRENCY_NOT_PLN`; exclude from PLN stats; do not auto-convert |
| Area as text | 1024, 1029 | Fix: parse to clean number (`199 m2` → 199, `30 sqm` → 30) |
| Area implausible (< 10 m²) | 1113 | Flag `AREA_IMPLAUSIBLE` (area is 3.45 m²) |
| Rooms as text | 1029 | Fix: parse string `"1"` to integer `1` |
| Rooms missing | 1112 | Flag `ROOMS_MISSING`; do not guess |
| ID as text | 1069 | Fix: parse string `"1069"` to integer `1069` |
| Floor as text | 1112 | Fix: map `"parter"` to `0`, then flag `FLOOR_MISMATCH_DESCRIPTION` (description states floor 4) |
| Floor > totalFloors | 1044 | Flag `FLOOR_EXCEEDS_TOTAL` (floor 14 of 4) |
| Floor contradicts description | 1044, 1061, 1112 | Flag `FLOOR_MISMATCH_DESCRIPTION` |
| Area contradicts description | 1067 | Flag `AREA_MISMATCH_DESCRIPTION` (field says 23.1 m², text says 37 m²) |
| Elevator contradicts description | 1055 | Flag `FEATURE_CONTRADICTS_DESCRIPTION`; keep both values (per D-03, never guess which is right) |
| Rooms contradict title | 1017 | Flag `ROOMS_MISMATCH_TITLE` (title says 4-room, rooms field is 2) |
| City variants & casing | 1037, 1041, 1047, 1052 | Fix: map to canonical title case with Polish diacritics |
| Offer type / property type variants | 1089, 1092 | Fix: map `Sale` → `sale`, `flat` → `apartment` |
| Feature synonyms & Polish terms | 1102, 1104 | Fix: map Polish words (`winda`, `balkon`, `umeblowane`) and variants (`Lift`, `Parking space`) to canonical vocabulary |
| Shouting title | 1047 | Fix: normalize casing and strip promotional words (`!!! OKAZJA`) |
| Invalid date format | 1079 | Fix: parse DD/MM/YYYY to ISO `YYYY-MM-DD` |
| Date in the future | 1078 | Flag `DATE_IN_FUTURE` |
| Image missing or file not found | 1062, 1072, 1114 | Fix: normalize missing/empty to null, show placeholder, flag `IMAGE_MISSING` |
| Description empty or thin | 1069, 1072 | Flag `DESCRIPTION_THIN` |
| District missing | 1114 | Flag `LOCATION_INCOMPLETE`; do not infer from title |
| Price per m² outliers | 1019, 1045 | Flag `PRICE_IMPLAUSIBLE`; exclude from median stats. 1113 is excluded here: its area is flagged, so its price per m² is not meaningful |
| Duplicate listings | 1016 → 1059, 1027 → 1084, 1111 → 1050 | Newest is canonical; on a tie, lowest id. Others get `duplicateOf` and are hidden from search |

## Result (npm run ingest)

100 read, 100 stored, 0 rejected. 3 duplicates marked.
15 listings carry quality flags (19 flags, 13 codes):

Duplicates (3):
  1016 → 1059
  1027 → 1084
  1111 → 1050

Flags by code:
  AREA_IMPLAUSIBLE:                  1113
  AREA_MISMATCH_DESCRIPTION:         1067
  CURRENCY_NOT_PLN:                  1095
  DATE_IN_FUTURE:                    1078
  DESCRIPTION_THIN:                  1069, 1072
  FEATURE_CONTRADICTS_DESCRIPTION:   1055
  FLOOR_EXCEEDS_TOTAL:               1044
  FLOOR_MISMATCH_DESCRIPTION:        1044, 1061, 1112
  IMAGE_MISSING:                     1062, 1072, 1114
  LOCATION_INCOMPLETE:               1114
  PRICE_IMPLAUSIBLE:                 1019, 1045
  ROOMS_MISMATCH_TITLE:              1017
  ROOMS_MISSING:                     1112