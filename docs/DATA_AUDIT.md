# Run: npx tsx scripts/audit.ts
────────────────────────────────────────────────────────────────
1. FIELD TYPE DISTRIBUTIONS
────────────────────────────────────────────────────────────────
Total: 100 listings

| Field        | string | number | null | array | missing/other |
| id           | 1 (1%) | 99 (99%) | 0 (0%) | 0 (0%) | 0 (0%) |
| title        | 100 (100%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| offerType    | 100 (100%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| propertyType | 100 (100%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| city         | 100 (100%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| district     | 99 (99%) | 0 (0%) | 1 (1%) | 0 (0%) | 0 (0%) |
| address      | 100 (100%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| price        | 4 (4%) | 95 (95%) | 1 (1%) | 0 (0%) | 0 (0%) |
| currency     | 99 (99%) | 0 (0%) | 0 (0%) | 0 (0%) | 1 (1%) |
| area         | 2 (2%) | 98 (98%) | 0 (0%) | 0 (0%) | 0 (0%) |
| rooms        | 1 (1%) | 98 (98%) | 0 (0%) | 0 (0%) | 1 (1%) |
| floor        | 1 (1%) | 90 (90%) | 0 (0%) | 0 (0%) | 9 (9%) |
| totalFloors  | 0 (0%) | 100 (100%) | 0 (0%) | 0 (0%) | 0 (0%) |
| yearBuilt    | 0 (0%) | 91 (91%) | 0 (0%) | 0 (0%) | 9 (9%) |
| description  | 100 (100%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |
| features     | 0 (0%) | 0 (0%) | 0 (0%) | 100 (100%) | 0 (0%) |
| image        | 99 (99%) | 0 (0%) | 1 (1%) | 0 (0%) | 0 (0%) |
| publishedAt  | 100 (100%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) |

────────────────────────────────────────────────────────────────
2. DISTINCT VALUES FOR CATEGORICAL FIELDS
────────────────────────────────────────────────────────────────

### city
| Value | Count | Notes |
|---|---|---|
| `Warsaw` | 30 | mixed/title case |
| `Kraków` | 17 | mixed/title case |
| `Wrocław` | 13 | mixed/title case |
| `Poznań` | 13 | mixed/title case |
| `Gdańsk` | 12 | mixed/title case |
| `Łódź` | 11 | mixed/title case |
| `kraków` | 1 | non-canonical — expected one of: Warsaw, Wrocław, Kraków, Gdańsk, Łódź, Poznań |
| `Gdansk` | 1 | mixed/title case; non-canonical — expected one of: Warsaw, Wrocław, Kraków, Gdańsk, Łódź, Poznań |
| `WROCŁAW` | 1 | ALL CAPS; non-canonical — expected one of: Warsaw, Wrocław, Kraków, Gdańsk, Łódź, Poznań |
| `Kraków ` | 1 | leading/trailing whitespace; mixed/title case |

### offerType
| Value | Count | Notes |
|---|---|---|
| `sale` | 75 |  |
| `rent` | 24 |  |
| `Sale` | 1 | mixed/title case; non-canonical — expected lowercase 'sale'/'rent' |

### propertyType
| Value | Count | Notes |
|---|---|---|
| `apartment` | 78 |  |
| `studio` | 12 |  |
| `house` | 9 |  |
| `flat` | 1 | non-canonical type — synonym or typo? |

### currency
| Value | Count | Notes |
|---|---|---|
| `PLN` | 98 |  |
| `(null/missing)` | 1 | non-PLN currency — price incomparable without conversion |
| `EUR` | 1 | non-PLN currency — price incomparable without conversion |

### features (all distinct values across all listings)
| Feature | Count | Notes |
|---|---|---|
| `elevator` | 60 |  |
| `furnished` | 45 |  |
| `air conditioning` | 43 |  |
| `pets allowed` | 37 |  |
| `balcony` | 36 |  |
| `storage room` | 30 |  |
| `basement` | 28 |  |
| `dishwasher` | 28 |  |
| `security` | 22 |  |
| `parking` | 20 |  |
| `garden` | 9 |  |
| `terrace` | 7 |  |
| `garage` | 4 |  |
| `winda` | 1 | Polish term |
| `umeblowane` | 1 | Polish term |
| `balkon` | 1 | Polish term |
| `Balcony` | 1 | capitalized |
| `Lift` | 1 | capitalized; synonym for 'elevator' |
| `Parking space` | 1 | capitalized; variant of 'parking' |

────────────────────────────────────────────────────────────────
3. NON-NUMERIC VALUES
────────────────────────────────────────────────────────────────

### price: 5 non-numeric value(s)
| ID | Raw value |
|---|---|
| 1005 | `"4700"` |
| 1011 | `"1 096 000 zł"` |
| 1018 | `"PLN 740,000"` |
| 1033 | `null` |
| 1075 | `"460 tys. zł"` |

### area: 2 non-numeric value(s)
| ID | Raw value |
|---|---|
| 1024 | `"199 m2"` |
| 1029 | `"30 sqm"` |

### rooms: 1 non-numeric value(s)
| ID | Raw value |
|---|---|
| 1029 | `"1"` |

### floor: 1 non-numeric value(s)
| ID | Raw value |
|---|---|
| 1112 | `"parter"` |

────────────────────────────────────────────────────────────────
4. LOGIC AND PHYSICAL CONTRADICTIONS
────────────────────────────────────────────────────────────────

### 4a. floor > totalFloors
  ID 1044: floor=14, totalFloors=4

### 4b. Description vs floor / totalFloors
  ID 1044: floor field=14 but description says "floor 2 of 4"
  ID 1061: floor=0 but description mentions "top floor"

### 4c. Area field vs description ('of X m²')
  ID 1067: area field=23.1 m², description says "of 37 m²"

### 4d. 'No elevator' in description vs elevator in features
  ID 1055: description says building has no lift but features lists "elevator"

### 4e. Room count in title vs rooms field
  ID 1017: title implies 4 rooms, rooms field=2

────────────────────────────────────────────────────────────────
5. INVALID OR SUSPICIOUS DATES
────────────────────────────────────────────────────────────────
Reference date: 2026-10-10

  ID 1078: future date — 2027-03-01
  ID 1079: wrong format — "14/09/2026" (expected YYYY-MM-DD)

────────────────────────────────────────────────────────────────
6. MISSING ASSETS
────────────────────────────────────────────────────────────────
  ID 1062: file not found — /images/IMG_20260811_142231.jpg
  ID 1072: image is null/undefined
  ID 1114: image is empty string

────────────────────────────────────────────────────────────────
7. PRICE PER M² OUTLIERS
────────────────────────────────────────────────────────────────
PLN listings only; non-numeric price or area excluded.

| City | Offer | Median PLN/m² | n | Outliers (ID, PLN/m²) |
|---|---|---|---|---|
| gdansk | sale | 14,859 | 1 | — |
| gdańsk | rent | 69 | 3 | — |
| gdańsk | sale | 14,120 | 8 | — |
| kraków | rent | 78 | 4 | — |
| kraków | sale | 16,575 | 15 | — |
| poznań | rent | 64 | 4 | — |
| poznań | sale | 10,505 | 8 | — |
| warsaw | rent | 70 | 7 | — |
| warsaw | sale | 18,715 | 22 | 1019 (53), 1113 (173,333) |
| wrocław | rent | 63 | 4 | — |
| wrocław | sale | 13,473 | 10 | — |
| łódź | rent | 53 | 2 | — |
| łódź | sale | 9,833 | 9 | 1045 (83,803) |

────────────────────────────────────────────────────────────────
8. DUPLICATE GROUPS
────────────────────────────────────────────────────────────────
Key: normalized address + area + rooms + offerType

  Group [1016, 1059]
    key = "ul. narutowicza 64|30|1|sale"
  Group [1027, 1084]
    key = "ul. powstańców śląskich 140|81.2|4|rent"
  Group [1050, 1111]
    key = "ul. górna wilda 179|67|3|sale"

────────────────────────────────────────────────────────────────
9. SUMMARY TABLE  ← paste into docs/DATA_AUDIT.md
────────────────────────────────────────────────────────────────

| Issue | Listing IDs | Recommended Rule |
|---|---|---|
| Non-numeric `price` | 1005, 1011, 1018, 1033, 1075 | Parse strings to number at ingest; flag null/unparseable as missing_price. |
| Non-numeric `area` | 1024, 1029 | Parse '199 m2' → 199, '30 sqm' → 30; flag unparseable. |
| Non-numeric `rooms` | 1029 | Parse string '"1"' → integer 1. |
| Non-numeric `floor` | 1112 | Map 'parter' → 0; flag other non-numeric strings. |
| floor > totalFloors | 1044 | Flag as quality_issue; keep raw values. |
| Floor/totalFloors contradicts description | 1044, 1061 | Flag as quality_issue; description floor value may be authoritative. |
| Area field contradicts description | 1067 | Flag as quality_issue; both values are suspect — keep raw, show warning. |
| 'No elevator' in description vs 'elevator' in features | 1055 | Remove 'elevator' from features at ingest; flag as quality_issue. |
| Rooms in title contradicts rooms field | 1017 | Flag as quality_issue; rooms field is likely wrong. |
| Invalid publishedAt format (not YYYY-MM-DD) | 1079 | Normalize DD/MM/YYYY → YYYY-MM-DD at ingest; flag unparseable dates. |
| Future publishedAt date | 1078 | Flag as quality_issue; accept value but display warning in UI. |
| Image null or empty | 1072, 1114 | Show placeholder in UI; flag as missing_image. |
| Image file missing from public/ | 1062 | Flag as missing_image; file path referenced does not exist on disk. |
| Price per m² outlier (>3× or <0.33× city+offerType median) | 1019, 1113, 1045 | Flag as outlier_price; exclude from median stats; show warning in UI and to agent. |
| Duplicate listings (address + area + rooms + offerType) | 1016, 1059, 1027, 1084, 1050, 1111 | Keep newest as canonical; set duplicateOf on others; hide duplicates from results. |
PS C:\Users\TESTER\Documents\homefinder-starter> 