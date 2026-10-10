import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const TODAY = new Date("2026-10-10");

type L = Record<string, unknown>;

const rawJson: unknown = JSON.parse(
  readFileSync(resolve(ROOT, "data/listings.raw.json"), "utf-8")
);
if (!Array.isArray(rawJson)) throw new Error("Expected JSON array");
const ls = rawJson as L[];
const N = ls.length;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lid(l: L): string {
  return String(l["id"] ?? "?");
}

function kindOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/** Parse a raw price value to a number (handles "1 096 000 zł", "460 tys. zł", "4700", etc.). */
function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().replace(/\s/g, "");
  const tysM = s.match(/([\d]+(?:[.,]\d+)?)\s*tys/);
  if (tysM) return parseFloat(tysM[1].replace(",", ".")) * 1000;
  const digits = s.replace(/[^\d]/g, "");
  const n = parseInt(digits, 10);
  return isNaN(n) ? null : n;
}

/** Parse a raw area value to a number (handles "199 m2", "30 sqm", numbers). */
function parseArea(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = v.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

function normalizeAddr(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^ulica\s+/, "ul. ")
    .replace(/\s+/g, " ");
}

function median(vals: number[]): number {
  if (!vals.length) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

// ─── Finding tracker ──────────────────────────────────────────────────────────

interface Finding {
  issue: string;
  ids: string[];
  rule: string;
}
const findings: Finding[] = [];

function note(issue: string, ids: string[], rule: string): void {
  if (ids.length > 0) findings.push({ issue, ids, rule });
}

function sec(n: number, title: string): void {
  const line = "─".repeat(64);
  console.log(`\n${line}\n${n}. ${title}\n${line}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Field type distributions
// ════════════════════════════════════════════════════════════════════════════

const FIELDS = [
  "id", "title", "offerType", "propertyType", "city", "district",
  "address", "price", "currency", "area", "rooms", "floor", "totalFloors",
  "yearBuilt", "description", "features", "image", "publishedAt",
];

sec(1, "FIELD TYPE DISTRIBUTIONS");
console.log(`Total: ${N} listings\n`);
console.log("| Field | string | number | null | array | missing/other |");
console.log("|---|---|---|---|---|---|");

for (const field of FIELDS) {
  let strN = 0, numN = 0, nullN = 0, arrN = 0, otherN = 0;
  for (const l of ls) {
    if (!(field in l)) { otherN++; continue; }
    switch (kindOf(l[field])) {
      case "string":  strN++;   break;
      case "number":  numN++;   break;
      case "null":    nullN++;  break;
      case "array":   arrN++;   break;
      default:        otherN++; break;
    }
  }
  const p = (n: number) => `${n} (${Math.round(n / N * 100)}%)`;
  console.log(
    `| ${field} | ${p(strN)} | ${p(numN)} | ${p(nullN)} | ${p(arrN)} | ${p(otherN)} |`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 2. Distinct values for categorical fields + features
// ════════════════════════════════════════════════════════════════════════════

sec(2, "DISTINCT VALUES FOR CATEGORICAL FIELDS");

const CANONICAL_CITIES = new Set([
  "Warsaw", "Wrocław", "Kraków", "Gdańsk", "Łódź", "Poznań",
]);
const CANONICAL_OFFER = new Set(["sale", "rent"]);
const CANONICAL_PROPERTY = new Set(["apartment", "house", "studio"]);

for (const field of ["city", "offerType", "propertyType", "currency"]) {
  const counts = new Map<string, number>();
  for (const l of ls) {
    const v = l[field];
    const key = v === null || v === undefined ? "(null/missing)" : String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log(`\n### ${field}`);
  console.log("| Value | Count | Notes |");
  console.log("|---|---|---|");

  for (const [val, cnt] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const notes: string[] = [];
    if (val !== val.trim()) notes.push("leading/trailing whitespace");
    if (val === val.toUpperCase() && val.length > 2 && val !== "PLN" && val !== "EUR")
      notes.push("ALL CAPS");
    if (
      val !== val.toLowerCase() &&
      val !== val.toUpperCase() &&
      val.length > 1 &&
      val !== "(null/missing)"
    )
      notes.push("mixed/title case");

    if (field === "city" && val !== "(null/missing)" && !CANONICAL_CITIES.has(val.trim()))
      notes.push(`non-canonical — expected one of: ${[...CANONICAL_CITIES].join(", ")}`);
    if (field === "offerType" && val !== "(null/missing)" && !CANONICAL_OFFER.has(val))
      notes.push("non-canonical — expected lowercase 'sale'/'rent'");
    if (field === "propertyType" && val !== "(null/missing)" && !CANONICAL_PROPERTY.has(val))
      notes.push("non-canonical type — synonym or typo?");
    if (field === "currency" && val !== "PLN")
      notes.push("non-PLN currency — price incomparable without conversion");

    console.log(`| \`${val}\` | ${cnt} | ${notes.join("; ")} |`);
  }
}

console.log("\n### features (all distinct values across all listings)");
console.log("| Feature | Count | Notes |");
console.log("|---|---|---|");

const POLISH_FEATS = new Set([
  "winda", "balkon", "umeblowane", "garaż", "piwnica", "taras", "ogród",
]);
const featCounts = new Map<string, number>();
for (const l of ls) {
  const feats = l["features"];
  if (!Array.isArray(feats)) continue;
  for (const f of feats) {
    const k = String(f);
    featCounts.set(k, (featCounts.get(k) ?? 0) + 1);
  }
}
for (const [feat, cnt] of [...featCounts.entries()].sort((a, b) => b[1] - a[1])) {
  const notes: string[] = [];
  const fl = feat.toLowerCase();
  if (POLISH_FEATS.has(fl)) notes.push("Polish term");
  if (feat.length > 0 && feat[0] !== feat[0].toLowerCase()) notes.push("capitalized");
  if (fl === "lift") notes.push("synonym for 'elevator'");
  if (fl === "parking space") notes.push("variant of 'parking'");
  console.log(`| \`${feat}\` | ${cnt} | ${notes.join("; ")} |`);
}

// ════════════════════════════════════════════════════════════════════════════
// 3. Non-numeric values for price, area, rooms, floor
// ════════════════════════════════════════════════════════════════════════════

sec(3, "NON-NUMERIC VALUES");

const NON_NUM_RULES: Record<string, string> = {
  price: "Parse strings to number at ingest; flag null/unparseable as missing_price.",
  area:  "Parse '199 m2' → 199, '30 sqm' → 30; flag unparseable.",
  rooms: "Parse string '\"1\"' → integer 1.",
  floor: "Map 'parter' → 0; flag other non-numeric strings.",
};

for (const field of ["price", "area", "rooms", "floor"]) {
  const bad: Array<[string, unknown]> = [];
  for (const l of ls) {
    const v = l[field];
    if (v !== undefined && typeof v !== "number") bad.push([lid(l), v]);
  }
  console.log(`\n### ${field}: ${bad.length} non-numeric value(s)`);
  if (bad.length) {
    console.log("| ID | Raw value |");
    console.log("|---|---|");
    for (const [i, r] of bad) {
      console.log(`| ${i} | \`${JSON.stringify(r)}\` |`);
    }
    note(`Non-numeric \`${field}\``, bad.map(([i]) => i), NON_NUM_RULES[field] ?? "");
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 4. Logic and physical contradictions
// ════════════════════════════════════════════════════════════════════════════

sec(4, "LOGIC AND PHYSICAL CONTRADICTIONS");

// 4a. floor > totalFloors
console.log("\n### 4a. floor > totalFloors");
{
  const bad: string[] = [];
  for (const l of ls) {
    const f = typeof l["floor"] === "number" ? l["floor"] : null;
    const t = typeof l["totalFloors"] === "number" ? l["totalFloors"] : null;
    if (f !== null && t !== null && f > t) {
      console.log(`  ID ${lid(l)}: floor=${f}, totalFloors=${t}`);
      bad.push(lid(l));
    }
  }
  if (!bad.length) console.log("  None.");
  note("floor > totalFloors", bad, "Flag as quality_issue; keep raw values.");
}

// 4b. Description contradicts floor or totalFloors field
console.log("\n### 4b. Description vs floor / totalFloors");
{
  const bad: string[] = [];
  for (const l of ls) {
    const desc = typeof l["description"] === "string" ? l["description"] : "";
    const floorF = typeof l["floor"] === "number" ? l["floor"] : null;
    const totalF = typeof l["totalFloors"] === "number" ? l["totalFloors"] : null;

    // floor=0 but description says "top floor"
    if (floorF === 0 && /top\s+floor/i.test(desc)) {
      console.log(`  ID ${lid(l)}: floor=0 but description mentions "top floor"`);
      bad.push(lid(l));
      continue;
    }

    // "floor X of Y" in description: check against fields
    const m = desc.match(/floor\s+(\d+)\s+of\s+(\d+)/i);
    if (m) {
      const df = parseInt(m[1], 10);
      const dt = parseInt(m[2], 10);
      if (floorF !== null && df !== floorF) {
        console.log(
          `  ID ${lid(l)}: floor field=${floorF} but description says "floor ${df} of ${dt}"`
        );
        if (!bad.includes(lid(l))) bad.push(lid(l));
      } else if (totalF !== null && dt !== totalF) {
        console.log(
          `  ID ${lid(l)}: totalFloors field=${totalF} but description says "floor ${df} of ${dt}"`
        );
        if (!bad.includes(lid(l))) bad.push(lid(l));
      }
    }
  }
  if (!bad.length) console.log("  None.");
  note(
    "Floor/totalFloors contradicts description",
    bad,
    "Flag as quality_issue; description floor value may be authoritative."
  );
}

// 4c. Area in description contradicts area field
console.log("\n### 4c. Area field vs description ('of X m²')");
{
  const bad: string[] = [];
  for (const l of ls) {
    const desc = typeof l["description"] === "string" ? l["description"] : "";
    const areaField = parseArea(l["area"]);
    if (areaField === null || areaField <= 0) continue;
    // Match "of N m²" — the common phrasing for apartment/house size
    const m = desc.match(/\bof\s+([\d]+(?:\.\d+)?)\s*m²/i);
    if (!m) continue;
    const descArea = parseFloat(m[1]);
    if (
      Math.abs(descArea - areaField) > 0.5 &&
      Math.abs(descArea - areaField) / areaField > 0.05
    ) {
      console.log(
        `  ID ${lid(l)}: area field=${areaField} m², description says "of ${descArea} m²"`
      );
      bad.push(lid(l));
    }
  }
  if (!bad.length) console.log("  None.");
  note(
    "Area field contradicts description",
    bad,
    "Flag as quality_issue; both values are suspect — keep raw, show warning."
  );
}

// 4d. "without elevator/lift" in description but features includes "elevator"
console.log("\n### 4d. 'No elevator' in description vs elevator in features");
{
  const bad: string[] = [];
  for (const l of ls) {
    const desc = typeof l["description"] === "string" ? l["description"] : "";
    const featsRaw = l["features"];
    const feats = Array.isArray(featsRaw)
      ? (featsRaw as unknown[]).map(f => String(f).toLowerCase())
      : [];
    if (
      /without\s+(?:a\s+)?(?:elevator|lift)/i.test(desc) &&
      feats.includes("elevator")
    ) {
      console.log(
        `  ID ${lid(l)}: description says building has no lift but features lists "elevator"`
      );
      bad.push(lid(l));
    }
  }
  if (!bad.length) console.log("  None.");
  note(
    "'No elevator' in description vs 'elevator' in features",
    bad,
    "Remove 'elevator' from features at ingest; flag as quality_issue."
  );
}

// 4e. Room count in title contradicts rooms field
console.log("\n### 4e. Room count in title vs rooms field");
{
  const bad: string[] = [];
  for (const l of ls) {
    const title = typeof l["title"] === "string" ? l["title"] : "";
    const rooms = typeof l["rooms"] === "number" ? l["rooms"] : null;
    if (rooms === null) continue;
    const m = title.match(/^(\d+)[\s-]room/i);
    if (!m) continue;
    const titleRooms = parseInt(m[1], 10);
    if (titleRooms !== rooms) {
      console.log(
        `  ID ${lid(l)}: title implies ${titleRooms} rooms, rooms field=${rooms}`
      );
      bad.push(lid(l));
    }
  }
  if (!bad.length) console.log("  None.");
  note(
    "Rooms in title contradicts rooms field",
    bad,
    "Flag as quality_issue; rooms field is likely wrong."
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 5. Invalid or suspicious dates
// ════════════════════════════════════════════════════════════════════════════

sec(5, "INVALID OR SUSPICIOUS DATES");
console.log(`Reference date: ${TODAY.toISOString().slice(0, 10)}\n`);

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const badFmt: string[] = [];
const futureDts: string[] = [];

for (const l of ls) {
  const pub = l["publishedAt"];
  const i = lid(l);
  if (typeof pub !== "string") {
    console.log(`  ID ${i}: publishedAt is ${kindOf(pub)}`);
    badFmt.push(i);
    continue;
  }
  if (!ISO_RE.test(pub)) {
    console.log(`  ID ${i}: wrong format — "${pub}" (expected YYYY-MM-DD)`);
    badFmt.push(i);
    continue;
  }
  if (new Date(pub) > TODAY) {
    console.log(`  ID ${i}: future date — ${pub}`);
    futureDts.push(i);
  }
}
if (!badFmt.length && !futureDts.length) console.log("  All dates valid.");
note(
  "Invalid publishedAt format (not YYYY-MM-DD)",
  badFmt,
  "Normalize DD/MM/YYYY → YYYY-MM-DD at ingest; flag unparseable dates."
);
note(
  "Future publishedAt date",
  futureDts,
  "Flag as quality_issue; accept value but display warning in UI."
);

// ════════════════════════════════════════════════════════════════════════════
// 6. Missing assets
// ════════════════════════════════════════════════════════════════════════════

sec(6, "MISSING ASSETS");

const imgNullIds: string[] = [];
const imgMissingIds: string[] = [];

for (const l of ls) {
  const img = l["image"];
  const i = lid(l);
  if (img === null || img === undefined || img === "") {
    console.log(`  ID ${i}: image is ${img === "" ? "empty string" : "null/undefined"}`);
    imgNullIds.push(i);
    continue;
  }
  if (typeof img !== "string") continue;
  const filePath = resolve(ROOT, "public" + img);
  if (!existsSync(filePath)) {
    console.log(`  ID ${i}: file not found — ${img}`);
    imgMissingIds.push(i);
  }
}
if (!imgNullIds.length && !imgMissingIds.length) console.log("  All images present.");
note(
  "Image null or empty",
  imgNullIds,
  "Show placeholder in UI; flag as missing_image."
);
note(
  "Image file missing from public/",
  imgMissingIds,
  "Flag as missing_image; file path referenced does not exist on disk."
);

// ════════════════════════════════════════════════════════════════════════════
// 7. Statistical outliers — price per m²
// ════════════════════════════════════════════════════════════════════════════

sec(7, "PRICE PER M² OUTLIERS");
console.log("PLN listings only; non-numeric price or area excluded.\n");

interface Ppm2 {
  id: string;
  ppm2: number;
}

const pGroups = new Map<string, Ppm2[]>();

for (const l of ls) {
  const price = parsePrice(l["price"]);
  const area = parseArea(l["area"]);
  const currency = l["currency"];
  if (price === null || area === null || area <= 0 || currency !== "PLN") continue;

  const offer = typeof l["offerType"] === "string" ? l["offerType"].toLowerCase() : "";
  const city = typeof l["city"] === "string" ? l["city"].trim().toLowerCase() : "";
  const key = `${city}|${offer}`;

  const arr = pGroups.get(key) ?? [];
  arr.push({ id: lid(l), ppm2: price / area });
  pGroups.set(key, arr);
}

console.log("| City | Offer | Median PLN/m² | n | Outliers (ID, PLN/m²) |");
console.log("|---|---|---|---|---|");

const outlierSet = new Set<string>();
for (const [key, entries] of [...pGroups.entries()].sort()) {
  const parts = key.split("|");
  const city = parts[0] ?? "";
  const offer = parts[1] ?? "";
  const med = median(entries.map(e => e.ppm2));
  const outliers = entries.filter(e => e.ppm2 > med * 3 || e.ppm2 < med * 0.33);
  for (const o of outliers) outlierSet.add(o.id);
  const outStr =
    outliers.map(o => `${o.id} (${Math.round(o.ppm2).toLocaleString()})`).join(", ") || "—";
  console.log(
    `| ${city} | ${offer} | ${Math.round(med).toLocaleString()} | ${entries.length} | ${outStr} |`
  );
}

note(
  "Price per m² outlier (>3× or <0.33× city+offerType median)",
  [...outlierSet],
  "Flag as outlier_price; exclude from median stats; show warning in UI and to agent."
);

// ════════════════════════════════════════════════════════════════════════════
// 8. Duplicate groups
// ════════════════════════════════════════════════════════════════════════════

sec(8, "DUPLICATE GROUPS");
console.log("Key: normalized address + area + rooms + offerType\n");

const dupeMap = new Map<string, string[]>();

for (const l of ls) {
  const addr = normalizeAddr(typeof l["address"] === "string" ? l["address"] : "");
  const area = parseArea(l["area"]) ?? "";
  const roomsRaw = l["rooms"];
  const rooms =
    typeof roomsRaw === "number"
      ? roomsRaw
      : typeof roomsRaw === "string"
      ? parseInt(roomsRaw, 10)
      : "";
  const offer = typeof l["offerType"] === "string" ? l["offerType"].toLowerCase() : "";
  const key = `${addr}|${area}|${rooms}|${offer}`;

  const arr = dupeMap.get(key) ?? [];
  arr.push(lid(l));
  dupeMap.set(key, arr);
}

let anyDupes = false;
const dupeIds: string[] = [];

for (const [key, ids] of dupeMap.entries()) {
  if (ids.length < 2) continue;
  anyDupes = true;
  console.log(`  Group [${ids.join(", ")}]`);
  console.log(`    key = "${key}"`);
  dupeIds.push(...ids);
}
if (!anyDupes) console.log("  None found.");
note(
  "Duplicate listings (address + area + rooms + offerType)",
  [...new Set(dupeIds)],
  "Keep newest as canonical; set duplicateOf on others; hide duplicates from results."
);

// ════════════════════════════════════════════════════════════════════════════
// 9. Summary Markdown table
// ════════════════════════════════════════════════════════════════════════════

sec(9, "SUMMARY TABLE  ← paste into docs/DATA_AUDIT.md");
console.log();
console.log("| Issue | Listing IDs | Recommended Rule |");
console.log("|---|---|---|");
for (const f of findings) {
  const idCol =
    f.ids.length <= 10
      ? f.ids.join(", ")
      : f.ids.slice(0, 10).join(", ") + ` … +${f.ids.length - 10} more`;
  console.log(`| ${f.issue} | ${idCol} | ${f.rule} |`);
}
