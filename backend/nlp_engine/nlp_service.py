import pandas as pd
import os
import uvicorn
import sys
import torch
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from transformers import (
    AutoTokenizer, 
    AutoModelForTokenClassification, 
    T5ForConditionalGeneration, 
    pipeline
)

# --- 0. THE CRITICAL WINDOWS FIX ---
if sys.platform == 'win32':
    import types
    sys.modules['fcntl'] = types.ModuleType('fcntl')

app = FastAPI(title="Herb-Drug Interaction (HDI) Clinical Engine v4.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. PATH CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) 
MODEL_PATH = os.path.join(BASE_DIR, "hdi_brain_v2")
CSV_PATH = os.path.join(BASE_DIR, "data", "HDI_Master_List.csv")
T5_MODEL_NAME = "t5-base"

# Global Engines
nlp_engine = None    
t5_model = None    
t5_tokenizer = None
interaction_db = pd.DataFrame()

def startup_load():
    global nlp_engine, t5_model, t5_tokenizer, interaction_db
    
    # A. Load BioBERT NER
    try:
        if os.path.exists(MODEL_PATH):
            print(f"🧠 Loading BioBERT from: {MODEL_PATH}")
            # Use AutoTokenizer for better Windows compatibility
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            model = AutoModelForTokenClassification.from_pretrained(MODEL_PATH)
            # Use 'simple' or 'first' to avoid the "##" subword issue automatically
            nlp_engine = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
            print("✅ BioBERT NER Online.")
    except Exception as e:
        print(f"❌ BioBERT Load Error: {e}")

    # B. Load T5
    try:
        print(f"✨ Initializing T5 Engine...")
        t5_tokenizer = AutoTokenizer.from_pretrained(T5_MODEL_NAME, model_max_length=512)
        t5_model = T5ForConditionalGeneration.from_pretrained(T5_MODEL_NAME)
        print("✅ T5 Engine Online.")
    except Exception as e:
        print(f"❌ T5 Load Error: {e}")

    # C. Load Knowledge Base
    if os.path.exists(CSV_PATH):
        try:
            # Added engine='python' to handle potential Windows file locks
            df = pd.read_csv(CSV_PATH, encoding='utf-8-sig', on_bad_lines='skip', engine='python')
            df.columns = [c.strip().lower() for c in df.columns]
            
            # IMPROVED COLUMN MAPPING: Ensure 'severity' is captured
            col_map = {'herb name': 'herb', 'drug name': 'drug', 'clinical effect': 'mechanism', 'interaction effect': 'mechanism'}
            df = df.rename(columns=col_map)
            
            # Standardize Severity
            if 'severity' not in df.columns:
                df['severity'] = 'Moderate'
            
            df['herb_low'] = df['herb'].astype(str).str.lower().str.strip()
            df['drug_low'] = df['drug'].astype(str).str.lower().str.strip()
            interaction_db = df
            print(f"✅ Database Ready: {len(df)} interactions loaded.")
        except Exception as e:
            print(f"❌ CSV Error: {e}")

startup_load()

class AnalyzeRequest(BaseModel):
    text: str

# --- 2. ENDPOINTS ---

@app.get("/api/list-all")
async def list_all():
    try:
        if interaction_db.empty:
            return {"status": "error", "message": "Database empty"}
        # Fill NaN to avoid JSON breakages
        clean_data = interaction_db.fillna("Unknown").to_dict(orient="records")
        return {"status": "success", "data": clean_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/analyze-text")
async def analyze_text(request: AnalyzeRequest):
    try:
        text = request.text
        if not text: return {"results": [], "status": "error"}
        
        found_herbs = []
        found_drugs = []
        
        if nlp_engine:
            ner_results = nlp_engine(text)
            for ent in ner_results:
                word = ent['word'].strip()
                label = ent['entity_group'].upper()
                
                # FIX: More robust labeling. If it's a chemical but in our Herb list, move it.
                is_known_herb = word.lower() in interaction_db['herb_low'].values
                
                if not is_known_herb and any(x in label for x in ["CHEM", "DRUG"]):
                    found_drugs.append({"term": word, "type": "Drug", "source": "AI"})
                else:
                    found_herbs.append({"term": word, "type": "Herb", "source": "AI"})

        final_results = []
        seen_pairs = set()

        # Deduplicate found lists
        unique_herbs = {h['term'].lower(): h['term'] for h in found_herbs}
        unique_drugs = {d['term'].lower(): d['term'] for d in found_drugs}

        for h_low, h_raw in unique_herbs.items():
            for d_low, d_raw in unique_drugs.items():
                match = interaction_db[
                    ((interaction_db['herb_low'] == h_low) & (interaction_db['drug_low'] == d_low)) |
                    ((interaction_db['herb_low'] == d_low) & (interaction_db['drug_low'] == h_low))
                ]
                
                if not match.empty:
                    for _, row in match.iterrows():
                        pair_id = tuple(sorted([h_low, d_low]))
                        if pair_id not in seen_pairs:
                            ai_advice = get_ai_summary(row['herb'], row['drug'], row['mechanism'])
                            final_results.append({
                                "herb": str(row['herb']).title(),
                                "drug": str(row['drug']).title(),
                                "severity": str(row.get('severity', 'MODERATE')).upper(),
                                "interaction_text": row['mechanism'],
                                "smart_advice": ai_advice
                            })
                            seen_pairs.add(pair_id)

        return {
            "status": "success", 
            "results": final_results, 
            "classification": {"herbs": list(unique_herbs.values()), "drugs": list(unique_drugs.values())}
        }
    except Exception as e:
        print(f"Scan Error: {e}")
        return {"status": "error", "message": str(e)}

def get_ai_summary(herb, drug, mechanism):
    if t5_model is None or t5_tokenizer is None:
        return "Clinical monitoring recommended."
    prompt = f"interaction between {herb} and {drug}: {mechanism}. Summary:"
    try:
        input_ids = t5_tokenizer.encode(prompt, return_tensors="pt")
        outputs = t5_model.generate(input_ids, max_length=50)
        return t5_tokenizer.decode(outputs[0], skip_special_tokens=True)
    except:
        return "Manual verification required."

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)