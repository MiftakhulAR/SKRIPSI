import { Meta, Result } from "./api";

/** Coverage per skill category for one career: sum(w*e)/sum(w) over the career's required skills in that category. */
export function categoryCoverage(r: Result, meta: Meta) {
  const catOf: Record<string, string> = {};
  for (const [cat, list] of Object.entries(meta.skills_by_category)) list.forEach((s) => (catOf[s] = cat));
  const acc: Record<string, { w: number; we: number; n: number; have: number }> = {};
  for (const s of r.skills) {
    const cat = catOf[s.skill] || "Other";
    const a = (acc[cat] ||= { w: 0, we: 0, n: 0, have: 0 });
    a.w += s.w; a.we += s.w * s.e; a.n += 1; if (s.e > 0) a.have += 1;
  }
  return Object.entries(acc).map(([cat, a]) => ({ cat, value: a.w ? a.we / a.w : 0, n: a.n, have: a.have }))
    .sort((x, y) => y.n - x.n);
}
