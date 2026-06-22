import pandas as pd
import json
import os

# 1. Define the filename (Make sure this matches your actual file in the sidebar!)
filename = 'data/HDI_Master_List.csv' 

if not os.path.exists(filename):
    print(f"❌ Error: I cannot find '{filename}'. Check the spelling or path.")
else:
    try:
        # Use 'on_bad_lines' to skip the messy rows (like Line 28)
        df = pd.read_csv(filename, on_bad_lines='skip', quotechar='"')
        
        # Clean column names (removes hidden spaces)
        df.columns = df.columns.str.strip()
        
        jsonl_data = []
        
        for _, row in df.iterrows():
            # Get data with fallback 'Unknown' if the column is missing
            herb = str(row.get('Herb Name', row.get('Herb', 'Unknown Herb'))).strip()
            drug = str(row.get('Drug Name', row.get('Drug', 'Unknown Drug'))).strip()
            mech = str(row.get('Mechanism Type', 'Pharmacological mechanism')).strip()
            effect = str(row.get('Clinical Effect', 'Altered clinical response')).strip()
            rec = str(row.get('Clinical Reccomendation', row.get('Clinical Recommendation', 'Monitor patient'))).strip()
            evid = str(row.get('Evidence Level', 'Clinical data')).strip()

            instruction = f"Analyze the interaction between {herb} and {drug}."
            response = f"{herb} acts as a {mech} agent on {drug}. Clinical Effect: {effect}. Recommendation: {rec}. Evidence: {evid}."
            
            jsonl_data.append({"instruction": instruction, "response": response})

        # 2. Write the JSONL file
        with open('train.jsonl', 'w', encoding='utf-8') as f:
            for entry in jsonl_data:
                f.write(json.dumps(entry) + '\n')
        
        print(f"✅ SUCCESS! Created 'train.jsonl' with {len(jsonl_data)} rows.")
        
    except Exception as e:
        print(f"❌ An error occurred during conversion: {e}")