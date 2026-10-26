"""Build the all-fields career pack from the O*NET 31.0 database (can also run in Colab).

Usage:  python tools/build_onet_pack.py "<folder with the O*NET 31.0 Excel files>"
Output: backend/artifacts/onet_*.csv and skill_crosswalk.csv (public data; O*NET is CC BY 4.0).

Rules (write these in Bab III):
  Occupations   every O*NET-SOC occupation that has skill/knowledge ratings (910), except the SOC codes
                already covered by the 15 validated IT careers (those keep the Indonesian job-ad profile).
  R(c)          Essential + Transferable Skills and Knowledge with Importance >= 3.0 (scale 1-5),
                w = (Importance - 1) / 4  -> 0.5 .. 1.0
                At least the MIN_REQ (20) most important skill/knowledge elements are kept, so an occupation with
                few highly rated elements is not favoured just because its R(c) is small.
                Work Styles with Work Styles Impact >= 2.0 (scale -3..3), w = Impact / 3 -> 0.67 .. 1.0
  Interests     up to 3 Specific Interest Areas with the best Summary Display Rank (1 = strongest)
  Crosswalk     each skill of the IT dictionary is linked to O*NET elements (researcher-made table, below),
                so a student's IT skills also count as evidence for O*NET occupations.
"""
import csv
import sys
from pathlib import Path

import pandas as pd

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "onet/db_31_0_excel")
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "artifacts"
IM_MIN, STYLE_MIN, MAX_INTERESTS, MIN_REQ = 3.0, 2.0, 3, 20

GROUPS = {"11": "Management", "13": "Business and Financial Operations", "15": "Computer and Mathematical",
          "17": "Architecture and Engineering", "19": "Life, Physical, and Social Science",
          "21": "Community and Social Service", "23": "Legal", "25": "Educational Instruction and Library",
          "27": "Arts, Design, Entertainment, Sports, and Media", "29": "Healthcare Practitioners and Technical",
          "31": "Healthcare Support", "33": "Protective Service", "35": "Food Preparation and Serving Related",
          "37": "Building and Grounds Cleaning and Maintenance", "39": "Personal Care and Service",
          "41": "Sales and Related", "43": "Office and Administrative Support", "45": "Farming, Fishing, and Forestry",
          "47": "Construction and Extraction", "49": "Installation, Maintenance, and Repair", "51": "Production",
          "53": "Transportation and Material Moving", "55": "Military Specific"}
CATEGORY = {"skill": "Skill umum", "knowledge": "Pengetahuan", "style": "Gaya kerja"}
KNOWLEDGE_RENAME = {"Mathematics": "Mathematics (knowledge)"}       # also an Essential Skill

# IT dictionary -> O*NET elements (by category, then per-skill additions)
BY_CATEGORY = {
    "Bahasa pemrograman": ["Programming", "Computers and Electronics"],
    "Web": ["Programming", "Computers and Electronics"],
    "Mobile": ["Programming", "Computers and Electronics"],
    "Basis data": ["Computers and Electronics"],
    "Data & AI": ["Computers and Electronics"],
    "Cloud": ["Computers and Electronics"],
    "Tools & DevOps": ["Computers and Electronics"],
    "Jaringan": ["Computers and Electronics", "Telecommunications"],
    "Keamanan": ["Computers and Electronics", "Public Safety and Security"],
    "Testing": ["Quality Control Analysis", "Computers and Electronics"],
    "Desain": ["Design", "Technology Design"],
    "Analisis sistem": ["Systems Analysis", "Operations Analysis"],
    "IT Support": ["Computers and Electronics", "Troubleshooting"],
    "Metodologi": [],
}
BY_SKILL = {
    "Statistics": ["Mathematics", "Mathematics (knowledge)"], "Machine Learning": ["Mathematics (knowledge)"],
    "Data Visualization": ["Communications and Media"], "Excel": ["Administrative"],
    "Microsoft Office": ["Administrative"], "ERP/SAP": ["Economics and Accounting"],
    "Hardware Troubleshooting": ["Repairing", "Equipment Maintenance"], "Helpdesk/Ticketing": ["Customer and Personal Service", "Service Orientation"],
    "User Research": ["Psychology", "Social Perceptiveness"], "Wireframe/Prototype": ["Fine Arts"],
    "Adobe Photoshop/Illustrator": ["Fine Arts"], "Figma": ["Fine Arts"],
    "Agile/Scrum": ["Coordination", "Time Management"], "SDLC": ["Systems Analysis"],
    "OOP": ["Programming"], "Design Pattern/Clean Code": ["Programming"],
    "Project Management": ["Administration and Management", "Time Management", "Management of Personnel Resources"],
    "Komunikasi": ["Speaking", "Active Listening", "Writing"], "Kerja tim": ["Coordination", "Cooperation"],
    "Problem solving": ["Complex Problem Solving", "Critical Thinking"], "Bahasa Inggris": ["Foreign Language"],
    "ISO 27001": ["Law and Government"], "Requirement Analysis": ["Operations Analysis", "Active Listening"],
}


def read(name):
    return pd.read_excel(SRC / f"{name}.xlsx")


def main():
    labels = list(csv.DictReader(open(HERE / "onet_labels_id.csv", encoding="utf-8")))
    lab = {(r["type"], r["name"]): r for r in labels}
    validated_soc = {r["onet_soc"] for r in csv.DictReader(open(OUT / "katalog_karier.csv", encoding="utf-8"))}

    rows = []
    for name, typ in (("Essential Skills", "skill"), ("Transferable Skills", "skill"), ("Knowledge", "knowledge")):
        d = read(name)
        d = d[d["Scale ID"] == "IM"]
        for r in d.itertuples(index=False):
            el = KNOWLEDGE_RENAME.get(r[3], r[3]) if typ == "knowledge" else r[3]
            rows.append((r[0], el, typ, float(r[6]), round((float(r[6]) - 1) / 4, 4)))
    ws = read("Work Styles")
    ws = ws[ws["Scale Name"] == "Work Styles Impact"]
    for r in ws.itertuples(index=False):
        rows.append((r[0], r[3], "style", float(r[6]), round(float(r[6]) / 3, 4)))
    req = pd.DataFrame(rows, columns=["soc", "element", "type", "rating", "w"])
    sk = req[req.type != "style"].copy()
    sk["order"] = sk.groupby("soc")["rating"].rank(ascending=False, method="first")
    keep_sk = sk[(sk.rating >= IM_MIN) | (sk.order <= MIN_REQ)]
    keep_st = req[(req.type == "style") & (req.rating >= STYLE_MIN)]
    req = pd.concat([keep_sk.drop(columns="order"), keep_st])

    occ = read("Occupation Data").rename(columns={"O*NET-SOC Code": "soc", "Title": "title", "Description": "description"})
    rated = set(read("Knowledge")["O*NET-SOC Code"])
    occ = occ[occ.soc.isin(rated) & ~occ.soc.isin(validated_soc)].copy()
    zones = read("Job Zones").set_index("O*NET-SOC Code")["Job Zone"].to_dict()
    sia = read("Specific Interest Areas")
    sia = sia[(sia["Scale Name"] == "Summary Display Rank") & (sia["Data Value"] > 0)].sort_values("Data Value")
    interests = sia.groupby("O*NET-SOC Code")["Element Name"].apply(lambda s: ";".join(list(s)[:MAX_INTERESTS])).to_dict()
    occ["job_zone"] = occ.soc.map(zones)
    occ["group_code"] = occ.soc.str[:2]
    occ["interest_areas"] = occ.soc.map(interests).fillna("")
    req = req[req.soc.isin(set(occ.soc))]
    occ = occ[occ.soc.isin(set(req.soc))]

    OUT.mkdir(exist_ok=True)
    occ[["soc", "title", "description", "job_zone", "group_code", "interest_areas"]].to_csv(OUT / "onet_occupations.csv", index=False)
    req[["soc", "element", "rating", "w"]].to_csv(OUT / "onet_requirements.csv", index=False)

    elements = []
    for (typ, name), r in lab.items():
        if typ in CATEGORY:
            el = KNOWLEDGE_RENAME.get(name, name) if typ == "knowledge" else name
            elements.append({"name": el, "name_id": r["name_id"], "type": typ, "kind": r["kind"], "category": CATEGORY[typ]})
    missing = set(req.element) - {e["name"] for e in elements}
    assert not missing, f"no label for {missing}"
    pd.DataFrame(elements).to_csv(OUT / "onet_elements.csv", index=False)
    pd.DataFrame([{"name": n, "name_id": r["name_id"]} for (t, n), r in lab.items() if t == "interest"]).to_csv(OUT / "onet_interests.csv", index=False)
    pd.DataFrame([{"code": c, "name": GROUPS[c], "name_id": lab[("group", c)]["name_id"]} for c in GROUPS]).to_csv(OUT / "onet_groups.csv", index=False)

    names = {e["name"] for e in elements}
    cross = []
    for r in csv.DictReader(open(OUT / "kamus_skill_v3.csv", encoding="utf-8")):
        for el in dict.fromkeys(BY_CATEGORY.get(r["kategori"], []) + BY_SKILL.get(r["skill"], [])):
            assert el in names, el
            cross.append({"skill": r["skill"], "element": el})
    pd.DataFrame(cross).to_csv(OUT / "skill_crosswalk.csv", index=False)

    per = req.groupby("soc").size()
    print(f"occupations {len(occ)} (excluded {len(validated_soc)} validated SOC codes), groups {occ.group_code.nunique()}, "
          f"requirements {len(req)} (median {int(per.median())} per occupation, min {per.min()}), "
          f"elements {len(elements)}, interest areas {sum(1 for k in lab if k[0] == 'interest')}, crosswalk links {len(cross)}, "
          f"occupations without interest area {(occ.interest_areas == '').sum()}")


if __name__ == "__main__":
    main()
