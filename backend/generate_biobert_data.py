import pandas as pd
import random
import re

# 1. LOAD YOUR DATA
# Using the paths you provided
drug_df = pd.read_csv(r'C:\Users\aditi\Downloads\Herb-Drug-Interactions-main\Drug_Source_Master.csv')
herb_df = pd.read_csv(r'C:\Users\aditi\Downloads\Herb-Drug-Interactions-main\Herb_Source_Master.csv')

# Convert to simple lists
drug_list = drug_df['Primary_Name'].dropna().unique().tolist()
herb_list = herb_df['Primary_Name'].dropna().unique().tolist()

# 2. SEED TEMPLATES (The "Swamp" logic)
templates = [
    "The patient is taking [HERB] and [DRUG].",
    "Does [HERB] interact with [DRUG]?",
    "Administered [DRUG] after the patient consumed [HERB].",
    "Clinical study of [HERB] and [DRUG] interactions.",
    "Possible contraindication between [HERB] and [DRUG]."
]

def generate_bio_data(num_sentences=100):
    final_data = []
    
    for _ in range(num_sentences):
        # Pick random items and template
        herb = random.choice(herb_list)
        drug = random.choice(drug_list)
        template = random.choice(templates)
        
        # Create sentence
        sentence = template.replace("[HERB]", herb).replace("[DRUG]", drug)
        
        # 3. TOKENIZATION & BIO TAGGING
        # Split sentence into words (tokens)
        words = sentence.split()
        tags = []
        
        for word in words:
            # Clean word for matching (remove punctuation)
            clean_word = re.sub(r'[^\w\s]', '', word)
            
            if clean_word == herb:
                tags.append("B-HERB")
            elif clean_word == drug:
                tags.append("B-DRUG")
            else:
                tags.append("O")
        
        final_data.append((words, tags))
    
    return final_data

# 4. SAVE AS TSV (BioBERT format)
training_samples = generate_bio_data(500) # Generating 500 samples

with open("biobert_train.tsv", "w") as f:
    f.write("Word\tTag\n")
    for words, tags in training_samples:
        for w, t in zip(words, tags):
            f.write(f"{w}\t{t}\n")
        f.write("\n") # Blank line between sentences

print("SUCCESS: 'biobert_train.tsv' created for BioBERT fine-tuning.")