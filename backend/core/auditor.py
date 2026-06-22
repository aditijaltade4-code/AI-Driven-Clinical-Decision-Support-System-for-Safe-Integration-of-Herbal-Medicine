from transformers import pipeline
import pandas as pd
from .bridge import InteractionBridge

class HDIAuditor:
    def __init__(self, model_path, db_path, master_path):
        self.nlp = pipeline("ner", model=model_path, tokenizer=model_path, aggregation_strategy="simple")
        self.db = pd.read_excel(db_path).astype(str)
        self.bridge = InteractionBridge(master_path)

    def audit_prescription(self, text):
        results = self.nlp(text)
        
        # 1. Extraction
        raw_herbs = [e['word'] for e in results if e['entity_group'] in ['LABEL_1', 'HERB']]
        drugs = list(set([e['word'].title() for e in results if e['entity_group'] in ['LABEL_3', 'DRUG']]))
        
        # 2. Normalization
        herb_str = " ".join(raw_herbs).lower()
        normalized_herb = self.bridge.normalize(herb_str)
        
        # 3. Clinical Search
        matches = []
        for drug in drugs:
            match = self.db[
                (self.db.iloc[:, 0].str.lower() == normalized_herb.lower()) & 
                (self.db.iloc[:, 4].str.contains(drug, case=False))
            ]
            if not match.empty:
                row = match.iloc[0]
                matches.append({
                    "herb": normalized_herb,
                    "drug": drug,
                    "severity": row.iloc[10], # Column K
                    "effect": row.iloc[11]    # Column L
                })
        return matches