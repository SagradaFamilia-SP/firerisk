import type { FireDetection } from '../../types/api';

export const FIRE_RENDER_LIMIT = 8000;
const GEOGRAPHIC_BUCKET_DEGREES = 5;

/**
 * Caps how many fires get rendered without letting recency dominate.
 *
 * The API already sorts fires newest-first. A plain slice(0, limit) at a
 * low zoom (world view), where far more than `limit` fires can be active
 * worldwide at once, ends up keeping almost none from whichever regions'
 * satellites happened to pass over least recently — entire continents can
 * disappear even though they have thousands of real detections. Round-robin
 * across a coarse geographic grid instead, so every region with active
 * fires keeps at least some markers, regardless of how recent they are.
 */
export function sampleFiresForRender(fires: FireDetection[], limit = FIRE_RENDER_LIMIT): FireDetection[] {
  if (fires.length <= limit) return fires;

  const buckets = new Map<string, FireDetection[]>();
  for (const fire of fires) {
    const key = `${Math.floor(fire.latitude / GEOGRAPHIC_BUCKET_DEGREES)}:${Math.floor(fire.longitude / GEOGRAPHIC_BUCKET_DEGREES)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(fire);
    else buckets.set(key, [fire]);
  }

  const bucketList = [...buckets.values()];
  const result: FireDetection[] = [];
  for (let round = 0; result.length < limit; round += 1) {
    let addedInRound = false;
    for (const bucket of bucketList) {
      if (round < bucket.length) {
        result.push(bucket[round]);
        addedInRound = true;
        if (result.length >= limit) break;
      }
    }
    if (!addedInRound) break;
  }
  return result;
}
