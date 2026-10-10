# Data Audit Findings & Normalization Rules

Run audit: `npx tsx scripts/audit.ts`

| Issue | Listing IDs | Recommended Rule |
|---|---|---|
| Price as text | 1005, 1011, 1018, 1075 | Fix: parse to clean number at ingest |
| Price null | 1033 | Keep null, render "Price on request" (valid inventory, not an error) |
| Currency missing but embedded in price text | 1018 | Fix: extract PLN from price string |
| Currency EUR | 1095 | Flag `non_pln_currency`; exclude from PLN stats; do not auto-convert |
| Area as text | 1024, 1029 | Fix: parse to clean number (`199 m2` → 199, `30 sqm` → 30) |
| Area implausible (< 10 m²) | 1113 | Flag `quality_issue` (area is 3.45 m²) |
| Rooms as text | 1029 | Fix: parse string `"1"` to integer `1` |
| Rooms missing | 1112 | Flag `quality_issue`; do not guess |
| ID as text | 1069 | Fix: parse string `"1069"` to integer `1069` |
| Floor as text | 1112 | Fix: map `"parter"` to `0`, then flag `quality_issue` (description states floor 4) |
| Floor > totalFloors | 1044 | Flag `quality_issue` (floor 14 of 4) |
| Floor contradicts description | 1044, 1061, 1112 | Flag `quality_issue` |
| Area contradicts description | 1067 | Flag `quality_issue` (field says 23.1 m², text says 37 m²) |
| Elevator contradicts description | 1055 | Flag `quality_issue`; keep both values (per D-03, never guess which is right) |
| Rooms contradict title | 1017 | Flag `quality_issue` (title says 4-room, rooms field is 2) |
| City variants & casing | 1037, 1041, 1047, 1052 | Fix: map to canonical title case with Polish diacritics |
| Offer type / property type variants | 1089, 1092 | Fix: map `Sale` → `sale`, `flat` → `apartment` |
| Feature synonyms & Polish terms | 1102, 1104 | Fix: map Polish words (`winda`, `balkon`, `umeblowane`) and variants (`Lift`, `Parking space`) to canonical vocabulary |
| Shouting title | 1047 | Fix: normalize casing and strip promotional words (`!!! OKAZJA`) |
| Invalid date format | 1079 | Fix: parse DD/MM/YYYY to ISO `YYYY-MM-DD` |
| Date in the future | 1078 | Flag `quality_issue` |
| Image missing or file not found | 1062, 1072, 1114 | Fix: normalize missing/empty to null, show placeholder, flag `missing_image` |
| Description empty or thin | 1069, 1072 | Flag `quality_issue` |
| District missing | 1114 | Flag `quality_issue`; do not infer from title |
| Price per m² outliers | 1019, 1045, 1113 | Flag `outlier_price`; exclude from median stats |
| Duplicate listings | 1016/1059, 1027/1084, 1050/1111 | Keep newest as canonical; mark older records with `duplicateOf` and hide from search |