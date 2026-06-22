import pandas as pd
import json
import os

# --- 1. SET PATHS ---
# Fixed the NameError by putting the filename in quotes
INTERACTION_CSV = r"C:\Users\aditi\Downloads\Herb-Drug-Interactions-main\Predictive_kg.csv"
MAPPING_JSON = "entity_mapping.json"
OUTPUT_FILE = "interaction_triples.csv"

def build_triples():
    print("Starting Step 2: Normalizing Interactions...")

    if not os.path.exists(INTERACTION_CSV):
        print(f"ERROR: Could not find the file at {INTERACTION_CSV}")
        return

    # --- 2. LOAD DATA ---
    with open(MAPPING_JSON, 'r') as f:
        data = json.load(f)
        entity_map = data['map']
        
    df = pd.read_csv(INTERACTION_CSV)

    # --- 3. NORMALIZATION LOGIC ---
    # Standardizing your "potent", "significant", "inhibitor" terms
    action_norm = {
        "potent inhibitor": "Significant Inhibitor",
        "significant inhibitor": "Significant Inhibitor",
        "blq": "Significant Inhibitor",
        "inhibition": "Inhibitor",
        "inhibitor": "Inhibitor",
        "anti-che": "Inhibitor",
        "antagonist": "Inhibitor",
        "induction": "Inducer",
        "inducer": "Inducer",
        "activation": "Inducer",
        "agonist": "Inducer",
        "no effect": "NE",
        "ne": "NE",
        "substrate": "Substrate"
    }

    # Severity Rank for Deduplication
    severity = {
        "Significant Inhibitor": 5,
        "Inhibitor": 4,
        "Inducer": 3,
        "Substrate": 2,
        "NE": 1,
        "Other": 0
    }

    def clean_entity(name):
        name_clean = str(name).lower().strip()
        # Look up the standardized Scientific Name from your Step 1 JSON
        return entity_map.get(name_clean, name)

    def clean_action(action):
        action_clean = str(action).lower().strip()
        return action_norm.get(action_clean, "Other")

    # --- 4. PROCESSING ---
    # We map 'Entity' to 'Head' and standardize the 'Action'
    df['Head'] = df['Entity'].apply(clean_entity)
    df['Relation'] = df['Action'].apply(clean_action)
    
    # Identify the Target column (Target or Mechanism)
    target_col = 'Target' if 'Target' in df.columns else 'Mechanism'
    df['Tail'] = df[target_col].astype(str).str.strip()
    
    # --- 5. DEDUPLICATION ---
    # Keep the most clinically significant interaction if duplicates exist
    df['Rank'] = df['Relation'].map(severity).fillna(0)
    df_sorted = df.sort_values(by=['Head', 'Tail', 'Rank'], ascending=[True, True, False])
    df_final = df_sorted.drop_duplicates(subset=['Head', 'Tail'], keep='first')

    # --- 6. SAVE ---
    df_final = df_final[['Head', 'Relation', 'Tail']]
    df_final.to_csv(OUTPUT_FILE, index=False)

    print(f"SUCCESS!")
    print(f"Normalized {len(df_final)} unique interaction edges.")
    print(f"File saved to: {os.path.abspath(OUTPUT_FILE)}")

if __name__ == "__main__":
    build_triples()