import { z } from 'zod';
import { RawListingSchema, type Listing } from './types';
import { normalizeListing, flagPriceOutliers } from './normalize';
import { markDuplicates } from './dedupe';

export interface IngestRow {
  listing: Listing;
  raw: unknown;
}

export interface RejectedRecord {
  id: string;
  reason: string;
}

const RecordIdSchema = z.object({ id: z.union([z.string(), z.number()]) });

function recordLabel(record: unknown, index: number): string {
  const parsed = RecordIdSchema.safeParse(record);
  return parsed.success ? String(parsed.data.id) : `unknown id (record ${index + 1})`;
}

export function ingestRecords(
  records: unknown[],
  context: { today: string; imageFiles: Set<string> },
): { rows: IngestRow[]; rejected: RejectedRecord[] } {
  const accepted: IngestRow[] = [];
  const rejected: RejectedRecord[] = [];

  records.forEach((raw, index) => {
    try {
      accepted.push({ listing: normalizeListing(RawListingSchema.parse(raw), context), raw });
    } catch (err) {
      rejected.push({
        id: recordLabel(raw, index),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Outliers are flagged after dedupe so duplicates don't skew medians.
  // Both steps return one listing per input, in the same order.
  const listings = flagPriceOutliers(markDuplicates(accepted.map((row) => row.listing)));
  const rows = listings.map((listing, i) => ({ listing, raw: accepted[i].raw }));

  return { rows, rejected };
}
