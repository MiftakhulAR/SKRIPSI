// Indonesian labels that come from the catalogue (filled from /api/meta): interest areas, skills
// (incl. the O*NET general skills, knowledge and work styles) and career fields (O*NET major groups).
export const dynamicInterestId: Record<string, string> = {};
export const dynamicSkillId: Record<string, string> = {};
export const groupNames: Record<string, { name: string; name_id: string | null }> = {};
export function registerInterestLabels(m: Record<string, string> | undefined) {
  if (m) Object.assign(dynamicInterestId, m);
}
export function registerCatalogLabels(meta: { interest_labels?: Record<string, string>; skill_labels?: Record<string, string>;
  groups?: { code: string; name: string; name_id: string | null }[] }) {
  registerInterestLabels(meta.interest_labels);
  if (meta.skill_labels) Object.assign(dynamicSkillId, meta.skill_labels);
  for (const g of meta.groups || []) groupNames[g.code] = { name: g.name, name_id: g.name_id };
}
