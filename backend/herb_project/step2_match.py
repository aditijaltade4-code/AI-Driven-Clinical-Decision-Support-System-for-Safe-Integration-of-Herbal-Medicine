import pandas as pd
import re

# =========================
# LOAD DATA
# =========================
df = pd.read_excel("all_pairs_with_duplicates.xlsx")
db = pd.read_csv("interaction_db.csv")
db.columns = db.columns.str.strip()

# =========================
# CLEAN FUNCTION (IMPROVED)
# =========================
def clean(text):
    if pd.isna(text):
        return ""
    text = str(text).lower().strip()
    text = re.sub(r'\s+', ' ', text)

    # remove special chars but keep spaces
    text = re.sub(r'[^a-z0-9\s]', '', text)

    return text.strip()

# =========================
# APPLY CLEANING
# =========================
df['drug'] = df['Drugs'].apply(clean)
df['herb'] = df['Herbs'].apply(clean)

db['herb'] = db['Herb Name'].apply(clean)
db['drug'] = db['Drug Name'].apply(clean)

# =========================
# 🔥 FIX 1: SPLIT MULTI-DRUG ENTRIES
# =========================
db_expanded = db.assign(
    drug=db['drug'].str.split('/')
).explode('drug')

db_expanded['drug'] = db_expanded['drug'].str.strip()

# =========================
# 🔥 FIX 2: BUILD CLEAN SET
# =========================
interaction_set = set(
    zip(db_expanded['herb'], db_expanded['drug'])
)

# =========================
# MATCH
# =========================
df['is_known_hdi'] = df.apply(
    lambda x: (x['herb'], x['drug']) in interaction_set,
    axis=1
)

known_df = df[df['is_known_hdi']].copy()

# =========================
# 1. UNIQUE INTERACTIONS
# =========================
unique_known = known_df[['herb', 'drug']].drop_duplicates()

# =========================
# 2. FREQUENCY
# =========================
interaction_freq = (
    known_df.groupby(['herb', 'drug'])
    .size()
    .reset_index(name='count')
    .sort_values(by='count', ascending=False)
)

top10_interactions = interaction_freq.head(10)

# =========================
# 3. TOP HERBS / DRUGS
# =========================
top_herbs = known_df['herb'].value_counts().reset_index()
top_herbs.columns = ['herb', 'count']

top_drugs = known_df['drug'].value_counts().reset_index()
top_drugs.columns = ['drug', 'count']

# =========================
# 4. PATIENT LEVEL ANALYTICS (FIXED)
# =========================

patient_interaction_freq = (
    known_df.groupby(['Patient_ID', 'herb', 'drug'])
    .size()
    .reset_index(name='count')
    .sort_values(by='count', ascending=False)
)

patient_hdi = (
    known_df.groupby('Patient_ID')
    .agg(
        total_hdi_events=('drug', 'count'),
        unique_hdi_pairs=('herb', lambda x: x.nunique())
    )
    .reset_index()
)

# =========================
# SAVE OUTPUT
# =========================
with pd.ExcelWriter("HDI_RESULTS_FINAL.xlsx") as writer:
    known_df.to_excel(writer, sheet_name="all_known_events", index=False)
    unique_known.to_excel(writer, sheet_name="unique_pairs", index=False)
    interaction_freq.to_excel(writer, sheet_name="interaction_frequency", index=False)
    top10_interactions.to_excel(writer, sheet_name="top10_interactions", index=False)
    top_herbs.to_excel(writer, sheet_name="top_herbs", index=False)
    top_drugs.to_excel(writer, sheet_name="top_drugs", index=False)
    patient_hdi.to_excel(writer, sheet_name="patient_exposure", index=False)
    patient_interaction_freq.to_excel(writer, sheet_name="patient_interaction_frequency", index=False)

# =========================
# SUMMARY
# =========================
print("DB size:", len(db_expanded))
print("Patient pairs:", len(df))
print("Matched HDIs:", len(known_df))
print("Match rate %:", len(known_df)/len(df)*100)

print("Unique interactions:", len(unique_known))
print("Top interaction:", top10_interactions.head(1).to_dict())