import pandas as pd

class InteractionBridge:
    def __init__(self, master_path):
        self.herb_map = {}
        # Load the Master CSV (Primary Name is Col 0, Synonyms are Col 1)
        df = pd.read_csv(master_path).astype(str)
        for _, row in df.iterrows():
            primary = row.iloc[0].strip()
            # Map primary to itself
            self.herb_map[primary.lower()] = primary
            # Map synonyms
            if len(row) > 1:
                syns = [s.strip().lower() for s in str(row.iloc[1]).split(',')]
                for s in syns:
                    if s != 'nan':
                        self.herb_map[s] = primary

    def normalize(self, detected_text):
        return self.herb_map.get(detected_text.lower().strip(), detected_text.title())