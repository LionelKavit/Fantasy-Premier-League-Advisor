import type { PlayerDetail } from "../player-detail";

export type { PlayerDetail };

// Per-id client cache so re-opening a dialog is instant (and the in-flight
// promise is shared, so a double-open fires one request). Lives for the session.
const cache = new Map<number, Promise<PlayerDetail>>();

export function fetchPlayerDetail(id: number): Promise<PlayerDetail> {
  const hit = cache.get(id);
  if (hit) return hit;

  const promise = fetch(`/api/player/${id}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`player ${id}: ${res.status}`);
      return (await res.json()) as PlayerDetail;
    })
    .catch((e) => {
      cache.delete(id); // don't cache failures — allow a retry on re-open
      throw e;
    });

  cache.set(id, promise);
  return promise;
}
