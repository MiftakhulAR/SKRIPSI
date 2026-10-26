// Top-level groups above the skill categories: IT skills > Programming, Web, Data & AI, ...
// Categories not listed here (e.g. a new one added by the admin) count as IT skills.
export type SkillGroup = "it" | "soft" | "general";

export const SKILL_GROUPS: SkillGroup[] = ["it", "soft", "general"];
const SOFT = new Set(["Soft skill", "Gaya kerja", "Bahasa"]);
const GENERAL = new Set(["Skill umum", "Pengetahuan"]);

export const groupOfCategory = (c: string): SkillGroup => (SOFT.has(c) ? "soft" : GENERAL.has(c) ? "general" : "it");
