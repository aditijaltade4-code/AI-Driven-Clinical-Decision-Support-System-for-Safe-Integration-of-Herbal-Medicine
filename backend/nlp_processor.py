import pandas as pd
import uvicorn
import sys
import torch
import networkx as nx
import re
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
import pickle
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import json
import os

# --- 1. CONFIGURATION SETUP ---
from config_utils import BLACKLIST 

BASE_DIR = Path(r"C:\Users\aditi\Downloads\Herb-Drug-Interactions-main")
MAPPING_FILE = BASE_DIR / "entity_mapping.json"

SYNONYM_MAP = {}
KNOWN_HERBS_LIST = []
EMBEDDINGS_DATA = None

if sys.platform == 'win32':
    import types
    sys.modules['fcntl'] = types.ModuleType('fcntl')

app = FastAPI(title="Herb-Drug Interaction (HDI) Clinical Engine v8.2")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. PATHS & MODELS ---
NER_MODEL_PATH = BASE_DIR / "hdi_model_biobert_ner"
CSV_PATH = BASE_DIR / "data" / "HDI_Master_List.csv"
PREDICTIVE_CSV_PATH = BASE_DIR / "Predictive_kg.csv"
EMBEDDINGS_PATH = BASE_DIR / "models" / "node_embeddings_v2.pkl"

PREDICTIVE_KG = nx.Graph()
nlp_engine = None     
interaction_db = pd.DataFrame()
KG = nx.Graph() 


# Global variable for the DB
interaction_db = pd.DataFrame()

# --- 1. DEFINE HELPERS FIRST ---
def get_col(df, options):
    """Finds a column name even if capitalization or spacing is slightly off."""
    cols = [c for c in df.columns]
    for opt in options:
        for c in cols:
            if c.lower().strip() == opt.lower() or c.lower().replace(" ", "_") == opt.lower():
                return c
    return None

def get_similarity(s1: str, s2: str) -> float:
    """Bigram-based similarity matching (Sorensen-Dice coefficient)."""
    if not s1 or not s2: return 0.0
    s1, s2 = s1.lower().replace(" ", ""), s2.lower().replace(" ", "")
    if s1 == s2: return 1.0
    if len(s1) < 2 or len(s2) < 2: return 0.0
    
    pairs1 = {s1[i:i+2] for i in range(len(s1)-1)}
    pairs2 = {s2[i:i+2] for i in range(len(s2)-1)}
    
    intersection = len(pairs1.intersection(pairs2))
    return (2.0 * intersection) / (len(pairs1) + len(pairs2))

def normalize_action(action):
    """Normalizes various action terms into standard roles."""
    a = str(action).lower().strip()
    if any(x in a for x in ["inhibitor", "inhibition", "potent inhibitor", "antagonist"]):
        return "INHIBITOR"
    if any(x in a for x in ["inducer", "induction", "activation", "agonist"]):
        return "INDUCER"
    if "substrate" in a:
        return "SUBSTRATE"
    return "UNKNOWN"

# --- 2. DEFINE THE LOADING FUNCTION ---
def load_database():
    global interaction_db
    paths = ['data/HDI_Master_List.csv', 'HDI_Master_List.csv', '../data/HDI_Master_List.csv']
    
    for p in paths:
        if os.path.exists(p):
            # Load raw data
            df = pd.read_csv(p)
            df.columns = [c.strip() for c in df.columns] # Clean hidden spaces

            # Use get_col to find the right headers dynamically
            herb_col = get_col(df, ['Herb Name', 'Herb', 'Herb_Name'])
            drug_col = get_col(df, ['Drug Name', 'Drug', 'Drug_Name'])
            sci_col = get_col(df, ['Scientific Name', 'Scientific_Name', 'Sci Name'])

            if not herb_col or not drug_col:
                print(f"❌ ERROR: Could not find Herb or Drug columns in {p}")
                continue

            # Create the normalized search columns
            df['herb_low'] = df[herb_col].astype(str).str.lower().str.strip()
            df['drug_low'] = df[drug_col].astype(str).str.lower().str.strip()
            
            if sci_col:
                df['sci_low'] = df[sci_col].astype(str).str.lower().str.strip()
            else:
                df['sci_low'] = df['herb_low']

            # Finalize the database
            interaction_db = df[df['herb_low'] != 'nan'].copy()
            interaction_db = interaction_db.fillna("N/A")
            
            print(f"✅ DATABASE LOADED SUCCESSFULLY from {p} ({len(interaction_db)} rows)")
            return
            
    print("❌ CRITICAL ERROR: Could not find HDI_Master_List.csv!")
# --- 2. CALL THE FUNCTION ---
# Now that helpers and the function are defined, we can safely run it
load_database()
print(f"Debug: interaction_db shape after load: {interaction_db.shape}")

# --- 3. CALL THE FUNCTION ---
# Now that helpers and the function are defined, we can safely run it
load_database()

def map_clinical_severity(mechanism: str, renal_status: str, liver_status: str, age: int):
    m = mechanism.lower()
    # 1. Base Score Determination (1 to 5)
    if any(x in m for x in ["bleeding", "hemorrhage", "toxicity", "qt prolongation", "fatal"]):
        score = 5
        sev, rec = "MAJOR", "Strictly Avoid / Contraindicated"
    elif any(x in m for x in ["cyp", "induction", "inhibition", "p450", "metabolism"]):
        score = 3
        sev, rec = "MODERATE", "Close clinical monitoring required"
    else:
        score = 1
        sev, rec = "MINOR", "Monitor for changes in therapeutic effect"

    # 2. Dynamic Organ Overrides
    is_renal_impaired = any(x in (renal_status or "").lower() for x in ["impaired", "failure", "low"])
    is_liver_impaired = any(x in (liver_status or "").lower() for x in ["impaired", "failure", "cirrhosis"])

    if is_renal_impaired and any(x in m for x in ["renal", "kidney", "clearance", "nephro"]):
        score = 5
        sev = "MAJOR"
        rec = f"CRITICAL: Reduced renal clearance ({renal_status})."

    if is_liver_impaired and any(x in m for x in ["cyp", "hepatic", "liver", "hepat"]):
        score = 5
        sev = "MAJOR"
        rec = "CRITICAL: Impaired hepatic metabolism."

    # 3. Geriatric Override (65+)
    if age and age >= 65:
        score = min(score + 1, 5)
        if score >= 4:
            sev = "MAJOR"

    return sev, rec, score
# Add this global at the top of your script
SYNONYM_MAP = {}

@app.on_event("startup")
def startup_load():
    global nlp_engine, interaction_db, EMBEDDINGS_DATA, SYNONYM_MAP
    try:
        print("🚀 Initializing Clinical CDSS Engines...")
        
        if SYNONYM_MAP is None: SYNONYM_MAP = {}

        # --- 1. BI-DIRECTIONAL MAPPING ---
        if MAPPING_FILE.exists():
            with open(MAPPING_FILE, "r") as f:
                map_data = json.load(f)
                for standard, common_name in map_data.get("synonyms", {}).items():
                    standard_clean = standard.lower().strip()
                    common_clean = str(common_name).lower().strip()
                    
                    # Map both ways so we never lose the reference
                    SYNONYM_MAP[common_clean] = standard_clean
                    SYNONYM_MAP[standard_clean] = common_clean 
            print(f"📖 SYNONYM MAP READY: {len(SYNONYM_MAP)} terms (Bi-directional)")

        # --- 2. ROBUST CSV LOADING ---
        if CSV_PATH.exists():
            df = pd.read_csv(CSV_PATH, sep=',', on_bad_lines='skip', encoding='utf-8-sig')
            df.columns = [c.strip() for c in df.columns]

            # Create clean search columns
            df['herb_low'] = df['Herb Name'].astype(str).str.lower().str.strip()
            df['drug_low'] = df['Drug Name'].astype(str).str.lower().str.strip()
            
            if 'Scientific Name' in df.columns:
                df['sci_low'] = df['Scientific Name'].astype(str).str.lower().str.strip()
            else:
                df['sci_low'] = df['herb_low']

            # Filter out junk
            interaction_db = df[(df['herb_low'] != 'nan') & (df['herb_low'] != '')].copy()
            interaction_db = interaction_db.fillna("N/A")
            print(f"✅ CSV INDEXED: {len(interaction_db)} interaction rules.")
        
        print("✅ ALL SYSTEMS ONLINE")
    except Exception as e:
        print(f"❌ Initialization Error: {e}")

def build_advanced_knowledge_graph():
    global KG, interaction_db
    if interaction_db.empty: return
    KG.clear()
    h_col = get_col(interaction_db, ['herb name', 'herb'])
    d_col = get_col(interaction_db, ['drug name', 'drug'])
    m_col = get_col(interaction_db, ['clinical effect', 'mechanism', 'effect'])
    for _, row in interaction_db.iterrows():
        h_val = str(row.get(h_col, 'N/A')).strip().title()
        d_val = str(row.get(d_col, 'N/A')).strip().title()
        if h_val != "N/A" and d_val != "N/A":
            KG.add_edge(h_val, d_val, mechanism=str(row.get(m_col, 'Interaction Detected')))

def build_predictive_knowledge_graph():
    global PREDICTIVE_KG
    if not PREDICTIVE_CSV_PATH.exists(): return
    PREDICTIVE_KG.clear()
    try:
        pred_df = pd.read_csv(PREDICTIVE_CSV_PATH)
        for _, row in pred_df.iterrows():
            entity = str(row['Entity']).strip().title()
            enzyme = str(row['Target']).strip().upper()
            action = str(row['Action']).strip()
            
            if PREDICTIVE_KG.has_edge(entity, enzyme):
                actions = PREDICTIVE_KG[entity][enzyme].get('actions', [])
                if action not in actions:
                    actions.append(action)
                PREDICTIVE_KG[entity][enzyme]['actions'] = actions
            else:
                PREDICTIVE_KG.add_edge(entity, enzyme, actions=[action])
    except Exception as e:
        print(f"❌ Error building Predictive KG: {e}")

class AnalyzeRequest(BaseModel):
    text: str
    age: Optional[int] = 0
    gender: Optional[str] = "Not Specified"
    renal_function: Optional[str] = "Normal"
    liver_function: Optional[str] = "Normal"

def generate_clinical_summary(results):
    return [{"type": "info", "text": "Analysis complete."}]

@app.post("/api/analyze-text")
async def analyze_text(request: AnalyzeRequest):
    print(f"🔍 [BIOBERT] Analyzing: {request.text[:100]}...")
    raw_herbs, raw_drugs = set(), set()
    final_results = []
    
    try:
        # 1. NER Layer (Unchanged)
        if nlp_engine:
            ner_results = nlp_engine(request.text)
            for ent in ner_results:
                label = str(ent.get('entity_group', ent.get('entity', ''))).upper()
                word = ent['word'].strip().replace("##", "").lower()
                if word in [b.lower() for b in BLACKLIST]: continue
                if 'HERB' in label or '1' in label: raw_herbs.add(word)
                elif 'DRUG' in label or '3' in label: raw_drugs.add(word)

        # 2. Cleanup and Dictionary Normalization
        clean_herbs = {h.lower().strip() for h in raw_herbs}
        clean_drugs = {d.lower().strip() for d in raw_drugs}
        processed_pairs = set()

        # Prepare the Database with pre-normalized search columns
        db = interaction_db.copy()
        db['h_norm'] = db['Herb Name'].astype(str).str.lower().str.strip()
        db['s_norm'] = db['Scientific Name'].astype(str).str.lower().str.strip()
        db['d_norm'] = db['Drug Name'].astype(str).str.lower().str.strip()

        for h_raw in clean_herbs:
            for d_raw in clean_drugs:
                pair = tuple(sorted([str(h_raw), str(d_raw)]))
                if pair in processed_pairs: continue
                processed_pairs.add(pair)

                h_input = h_raw.lower().strip()
                d_input = d_raw.lower().strip()
                
                # The "Bridge" value (Scientific)
                h_sci_mapped = SYNONYM_MAP.get(h_input, h_input).lower().strip()

                match_found = False

                # LAYER 1: CSV SEARCH (FIXED NORMALIZATION + FUZZY MATCH)
                # ==========================================================
                # We check the CSV for the RAW input (turmeric) 
                # AND the mapped scientific name (curcuma longa)
                
                THRESHOLD = 0.8
                
                def is_match(row_h, row_s, row_d, h_in, h_sci, d_in):
                    # Check drug first (usually more specific)
                    d_match = (row_d == d_in) or (get_similarity(row_d, d_in) >= THRESHOLD)
                    if not d_match: return False
                    
                    # Check herb or scientific
                    h_match = (row_h == h_in) or (row_s == h_in) or \
                              (row_h == h_sci) or (row_s == h_sci) or \
                              (get_similarity(row_h, h_in) >= THRESHOLD) or \
                              (get_similarity(row_s, h_in) >= THRESHOLD) or \
                              (get_similarity(row_h, h_sci) >= THRESHOLD) or \
                              (get_similarity(row_s, h_sci) >= THRESHOLD)
                    return h_match

                # Applying the match logic to the dataframe
                mask = db.apply(lambda row: is_match(row['h_norm'], row['s_norm'], row['d_norm'], h_input, h_sci_mapped, d_input), axis=1)
                match = db[mask]

                if not match.empty:
                    row = match.iloc[0]
                    mech_val = row.get('Clinical Effect', row.get('Mechanism Type', "Interaction Detected"))
                    sev_raw = row.get('Severity', 'Moderate')
                    rec_val = row.get('Clinical Recommendation', 'Consult with a healthcare provider.')

                    s_map, r_map, _ = map_clinical_severity(
                        str(mech_val), request.renal_function, request.liver_function, request.age
                    )

                    final_results.append({
                        "herb_name": h_input.title(),
                        "drug_name": d_input.title(),
                        "severity": str(sev_raw).upper() if pd.notna(sev_raw) else s_map,
                        "mechanism": str(mech_val),
                        "clinical_recommendation": str(rec_val),
                        "source_type": "Verified Clinical Data"
                    })
                    match_found = True
                    print(f"🎯 CSV HIT: Found {h_input} in database")

                # ==========================================================
                # LAYER 2: FALLBACKS (Only if CSV fails)
                # ==========================================================
                if not match_found:
                    # Knowledge Graph
                    h_kg = h_sci_mapped.title()
                    d_kg = d_input.title()
                    if h_kg in PREDICTIVE_KG and d_kg in PREDICTIVE_KG:
                        shared_targets = list(set(PREDICTIVE_KG.neighbors(h_kg)).intersection(set(PREDICTIVE_KG.neighbors(d_kg))))
                        for target in shared_targets:
                            h_actions = [normalize_action(a) for a in PREDICTIVE_KG[h_kg][target].get('actions', [])]
                            d_actions = [normalize_action(a) for a in PREDICTIVE_KG[d_kg][target].get('actions', [])]
                            
                            for ha in h_actions:
                                for da in d_actions:
                                    mech, effect, rec, sev = None, None, None, "MODERATE"
                                    
                                    # Logic cases based on Herb/Drug roles
                                    if ha == "INHIBITOR" and da == "SUBSTRATE":
                                        mech = f"PATHWAY SUPPRESSION: {h_input.title()} inhibits {target}, which handles {d_input.title()}."
                                        effect = "Catalytic/transport capacity is reduced; drug disposition becomes constrained."
                                        rec = "Evaluate clinical necessity, therapeutic index sensitivity, and consider alternative pathways or dose optimization."
                                        sev = "MAJOR"
                                    elif ha == "INDUCER" and da == "SUBSTRATE":
                                        mech = f"PATHWAY ACTIVATION: {h_input.title()} induces {target}, enhancing {d_input.title()} clearance."
                                        effect = "System throughput is enhanced over time due to increased functional capacity."
                                        rec = "Monitor for reduced drug efficacy. Account for induction kinetics and delayed onset/reversibility."
                                        sev = "MODERATE"
                                    elif ha == "INHIBITOR" and da == "INHIBITOR":
                                        mech = f"CUMULATIVE SUPPRESSION: Both act as inhibitors on {target}."
                                        effect = "Additive node constraint may exceed acceptable physiological tolerance."
                                        rec = "Evaluate total pathway suppression and monitor for toxicity from other substrates of this node."
                                        sev = "MAJOR"
                                    elif ha == "INDUCER" and da == "INDUCER":
                                        mech = f"COORDINATED UPREGULATION: Both act as inducers on {target}."
                                        effect = "Coordinated pathway upregulation may impact all substrates of this biological node."
                                        rec = "Monitor for broad metabolism changes."
                                        sev = "MINOR"
                                    elif ha == "SUBSTRATE" and da == "INHIBITOR":
                                        mech = f"ALTERED HERB HANDLING: {d_input.title()} inhibits {target}, affecting {h_input.title()} metabolism."
                                        effect = "Reduced node activity alters the biological handling and exposure of the herb."
                                        rec = "Evaluate herb safety profile and clinical relevance of increased exposure."
                                        sev = "MODERATE"
                                    elif ha == "SUBSTRATE" and da == "INDUCER":
                                        mech = f"ALTERED HERB THROUGHPUT: {d_input.title()} induces {target}, increasing {h_input.title()} clearance."
                                        effect = "Enhanced node capacity may reduce sustained biological exposure of the herb."
                                        rec = "Evaluate whether herb efficacy depends on sustained exposure levels."
                                        sev = "MINOR"

                                    if mech:
                                        final_results.append({
                                            "herb_name": h_input.title(), "drug_name": d_input.title(), 
                                            "severity": sev, "mechanism": mech, 
                                            "clinical_recommendation": f"{effect} {rec}", 
                                            "source_type": "Predictive KG"
                                        })
                                        match_found = True

                if not match_found:
                    # Final Fallback (Log missing pair)
                    print(f"⚠️ NO MATCH: No record or KG pathway for {h_input} + {d_input}")

        # --- 3. FINAL DEDUPLICATION ---
        # Ensure we don't return the same Herb-Drug pair multiple times
        unique_results = []
        seen_keys = set()
        for res in final_results:
            key = f"{res['herb_name'].lower()}::{res['drug_name'].lower()}"
            if key not in seen_keys:
                seen_keys.add(key)
                unique_results.append(res)

        return {
            "status": "success",
            "results": unique_results,
            "entities": {"herbs": list(clean_herbs), "drugs": list(clean_drugs)}
        }

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return {"status": "error", "message": str(e)}
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)