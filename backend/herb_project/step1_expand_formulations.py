import pandas as pd
import re

# =========================
# FORMULATION → HERB MAP
# =========================

FORMULATION_MAP = {

    "yograj guggul": ["guggul", "ginger", "black pepper", "long pepper", "ajwain", "chitraka"],

    "kaishore guggul": ["guggul", "triphala", "guduchi", "ginger", "long pepper"],

    "simhanada guggulu": ["guggul", "triphala", "ginger", "long pepper"],

    "chandraprabha vati": ["guggul", "triphala", "ginger", "black pepper", "long pepper", "guduchi"],

    "arogyavardhini vati": ["guggul", "triphala", "haritaki", "baheda", "guduchi"],

    "avipattikar churna": ["triphala", "ginger", "black pepper", "long pepper", "cardamom", "cinnamon"],

    "hingvashtak churna": ["hing", "ginger", "black pepper", "long pepper", "ajwain"],

    "ajmodadi churna": ["ajwain", "ginger", "black pepper", "long pepper"],

    "kanchanar guggul": ["guggul", "triphala", "haritaki", "baheda"],

    "talisadi churna": ["ginger", "long pepper", "cardamom", "cinnamon"],

    "abhayarishta": ["triphala"],

    "tiryaq-e-nazla": ["ginger", "black pepper", "long pepper"],

    "ashwagandha": ["ashwagandha"]
}

# =========================
# LOAD DATA
# =========================

df = pd.read_excel(r"C:\Users\aditi\Downloads\Herb-Drug-Interactions-main\herb_project\final_expanded_ready.xlsx")

# =========================
# CLEAN FUNCTION
# =========================

def clean(x):
    if pd.isna(x):
        return ""
    x = str(x).lower().strip()
    x = re.sub(r'\s+', ' ', x)
    return x

# =========================
# EXPAND FUNCTION
# =========================

def expand_formulation(x):
    x = clean(x)

    if x in FORMULATION_MAP:
        return FORMULATION_MAP[x]

    return [x]

# =========================
# APPLY CLEANING
# =========================

df['Drug_clean'] = df['Drugs'].apply(clean)

# =========================
# DEBUG 1 — BEFORE EXPANSION
# =========================

print("\n===== BEFORE EXPANSION SAMPLE =====")
print(df['Drug_clean'].head(20))

# =========================
# APPLY EXPANSION
# =========================

df['Herb_expanded'] = df['Drug_clean'].apply(expand_formulation)

# =========================
# DEBUG 2 — CHECK EXPANSION OUTPUT
# =========================

print("\n===== EXPANSION SAMPLE (LIST CHECK) =====")
print(df[['Drug_clean', 'Herb_expanded']].head(20))

# Check if real expansion is happening
print("\n===== CHECK: Yograj Guggul expansion =====")
test = df[df['Drug_clean'].str.contains("gugg", na=False)]
print(test[['Drug_clean', 'Herb_expanded']].head(10))

# =========================
# FLATTEN
# =========================

before = len(df)
df = df.explode('Herb_expanded')
after = len(df)

df.rename(columns={'Herb_expanded': 'Herb_clean'}, inplace=True)

# =========================
# DEBUG 3 — AFTER EXPLOSION
# =========================

print("\n===== ROW COUNT CHECK =====")
print("Before explode:", before)
print("After explode:", after)

print("\n===== FINAL SAMPLE =====")
print(df[['Drug_clean', 'Herb_clean']].head(20))

# =========================
# SAVE
# =========================

df.to_excel("step1_expanded_herb_level.xlsx", index=False)

print("\nDONE: Expansion completed successfully")