# Eval results

Date: 2026-10-11

Model: `gemini-3.6-flash`

| Result | Scenario | Returned ids | Model calls |
|---|---|---|---|
| PASS | structured-sale | 1101, 1085, 1037 | 3 |
| PASS | stated-need-not-overclaimed | 1037, 1101, 1085 | 5 |
| PASS | nothing-fits | none | 5 |
| PASS | polish-city-name | 1070, 1010, 1103 | 4 |
| PASS | suspicious-price | 1060, 1032, 1114 | 4 |
| PASS | rent-inferred | 1038, 1077, 1112 | 3 |
| PASS | pets-offer-type-not-stated | 1080, 1007, 1031 | 3 |
| PASS | no-duplicates | 1059, 1002 | 3 |
| PASS | out-of-scope | none | 1 |

**9 / 9 passed, 31 model calls, model gemini-3.6-flash**
