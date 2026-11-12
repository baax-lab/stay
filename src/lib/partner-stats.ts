/** Partnerbewertung und Leistungsübersicht (Konzept §10). */

export type RatingInput = { reliability: number; quality: number; speed: number };

export function ratingScore(r: RatingInput): number {
  return Math.round(((r.reliability + r.quality + r.speed) / 3) * 10) / 10;
}

export function averageRatings(list: RatingInput[]): { score: number | null; reliability: number | null; quality: number | null; speed: number | null; count: number } {
  if (list.length === 0) return { score: null, reliability: null, quality: null, speed: null, count: 0 };
  const avg = (k: keyof RatingInput) => Math.round((list.reduce((s, r) => s + r[k], 0) / list.length) * 10) / 10;
  const reliability = avg("reliability");
  const quality = avg("quality");
  const speed = avg("speed");
  return { score: Math.round(((reliability + quality + speed) / 3) * 10) / 10, reliability, quality, speed, count: list.length };
}

export function validRating(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

/** Trefferquote: Anteil eingereichter Objekte, die mindestens einem Käufer vorgestellt wurden. */
export function hitRate(submitted: number, presented: number): number | null {
  return submitted > 0 ? Math.round((presented / submitted) * 100) : null;
}
