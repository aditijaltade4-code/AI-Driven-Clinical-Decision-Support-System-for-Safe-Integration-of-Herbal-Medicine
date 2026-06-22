import pandas as pd
import itertools
import re

# =========================
# LOAD
# =========================
df = pd.read_excel("herb_project/Results Final.xlsx")
df.columns = df.columns.str.strip()

df = df.rename(columns={
    "Patient_ ID": "Patient_ID",
    "System Affected by Diesease": "System",
    "Herbal Formulations/Herbs": "Herbs",
    "Pharmacological Drug": "Drugs",
    "Drug Class": "Drug_Class"
})

# =========================
# NORMALIZATION MAP
# =========================
NORMALIZATION_MAP = {
    "kaishore guggulu": "kaishore guggul",
    "kishore guggulu": "kaishore guggul",
    "kaishor guggul": "kaishore guggul",
    "arogyavardhini": "arogyavardhini vati",
    "arogyavardhini varti": "arogyavardhini vati",
    "chandraprabhavati": "chandraprabha vati",
    "yogiraj guggul": "yograj guggul",
    "guggulu": "guggul",
    "ajmodadi churn": "ajmodadi churna",
    "ajmodadi churan": "ajmodadi churna",
}

# =========================
# FORMULATION MAP
# =========================
FORMULATION_MAP = {
    "yograj guggul": ["triphala","guggul","ginger","black pepper","long pepper","cinnamon"],
    "kaishore guggul": ["triphala","guduchi","guggul","ginger","black pepper","long pepper"],
    "simhanada guggulu": ["triphala","guggul"],
    "arogyavardhini vati": ["triphala","guggul"],
    "kanchanar guggul": ["triphala","guggul","ginger","black pepper","long pepper","cinnamon"],
    "avipattikar churna": ["ginger","black pepper","long pepper","cinnamon"],
    "hingvashtak churna": ["ginger","black pepper","long pepper"],
    "ajmodadi churna": ["ginger","black pepper","long pepper"],
    "talisadi churna": ["ginger","black pepper","long pepper","cinnamon"],
    "abhayarishta": ["triphala","ginger"],
    "arshkuthar ras": ["black pepper"],
    "sutshekhar ras": ["ginger","black pepper","long pepper","cinnamon"],
    "rasnadi churna": ["ginger","black pepper","long pepper"],
    "vatvidhvansan ras": ["black pepper"],
    "narayani oil": ["ashwagandha"]
}

# =========================
# CLEAN
# =========================
def clean_text(x):
    if pd.isna(x):
        return "unknown"
    x = str(x).lower()
    x = re.sub(r'[\d\+\;\/±]', ',', x)
    x = re.sub(r'\s+', ' ', x)
    return x.strip()

df['Drugs'] = df['Drugs'].apply(clean_text)
df['Herbs'] = df['Herbs'].apply(clean_text)

# =========================
# SAFE SPLIT (IMPORTANT FIX)
# =========================
def split_safe(x):
    if x == "unknown":
        return []
    return [i.strip() for i in str(x).split(",") if i.strip()]

df['Drugs'] = df['Drugs'].apply(split_safe)
df['Herbs'] = df['Herbs'].apply(split_safe)

# =========================
# NORMALIZE FUNCTION
# =========================
def normalize(h):
    h = h.strip().lower()
    return NORMALIZATION_MAP.get(h, h)

# =========================
# EXPAND HERBS SAFELY
# =========================
def expand_herbs(herb_list):
    expanded = []

    for herb in herb_list:
        herb = normalize(herb)

        if herb in FORMULATION_MAP:
            for h in FORMULATION_MAP[herb]:
                expanded.append((h, herb))  # (herb, source)
        else:
            expanded.append((herb, "single"))

    return expanded

df['Herb_Expanded'] = df['Herbs'].apply(expand_herbs)

df = df.explode('Herb_Expanded')

df['Herbs'] = df['Herb_Expanded'].apply(lambda x: x[0])
df['Formulation_Source'] = df['Herb_Expanded'].apply(lambda x: x[1])

# =========================
# FINAL SAFE PAIRING
# =========================
rows = []

for _, row in df.iterrows():
    drugs = row['Drugs']
    herbs = [row['Herbs']]

    if not drugs or not herbs:
        continue

    for d, h in itertools.product(drugs, herbs):
        rows.append({
            "Patient_ID": row["Patient_ID"],
            "Drug": d,
            "Herb": h,
            "Source": row["Formulation_Source"]
        })

final_df = pd.DataFrame(rows)

# =========================
# OUTPUT
# =========================
final_df.to_excel("FINAL_EXPANDED.xlsx", index=False)

print("\nDONE")
print("Rows:", len(final_df))
print("Unique pairs:", final_df[['Drug','Herb']].drop_duplicates().shape[0])