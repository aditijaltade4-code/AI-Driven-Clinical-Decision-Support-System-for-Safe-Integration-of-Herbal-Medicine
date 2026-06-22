import pandas as pd
import json
import os

# --- 1. SET PATHS ---
HERB_PATH = r"C:\Users\aditi\Downloads\Herb-Drug-Interactions-main\data\Herb_Source_Master.csv"
DRUG_PATH = r"C:\Users\aditi\Downloads\Herb-Drug-Interactions-main\Drug_Source_Master.csv"
OUTPUT_FILE = "entity_mapping.json"

def build_master_index():
    print("Starting Step 1: Building Canonical Index...")
    
    # Verify files
    if not os.path.exists(HERB_PATH) or not os.path.exists(DRUG_PATH):
        print("ERROR: Check your file paths. One or both CSVs were not found.")
        return

    # --- 2. LOAD DATA ---
    herbs = pd.read_csv(HERB_PATH)
    drugs = pd.read_csv(DRUG_PATH)

    # Key: synonym (lowercase) -> Value: Scientific_Name (ID)
    entity_map = {}
    # Key: Scientific_Name -> Value: Type (herb/drug)
    metadata = {}

    def process_df(df, category):
        for _, row in df.iterrows():
            # Use Scientific_Name as the unique ID for the Knowledge Graph
            canonical_id = str(row['Scientific_Name']).strip()
            
            # Save if it's a herb or drug
            metadata[canonical_id] = category
            
            # Columns to scan for synonyms
            name_cols = ['Primary_Name', 'Scientific_Name', 'Common_Name_1', 'Common_Name_2', 'Common_Name_3']
            
            for col in name_cols:
                if pd.notna(row[col]):
                    synonym = str(row[col]).strip().lower()
                    # Map synonym to the one true Scientific Name
                    entity_map[synonym] = canonical_id

    # Run processing
    process_df(herbs, "herb")
    process_df(drugs, "drug")

    # --- 3. SAVE OUTCOME ---
    # We save this as a JSON file so Step 2 can use it later
    result = {
        "map": entity_map,
        "metadata": metadata
    }
    
    with open(OUTPUT_FILE, "w") as f:
        json.dump(result, f, indent=4)

    print(f"SUCCESS!")
    print(f"Mapped {len(entity_map)} synonyms to {len(metadata)} unique entities.")
    print(f"Outcome saved to: {os.path.abspath(OUTPUT_FILE)}")

if __name__ == "__main__":
    build_master_index()