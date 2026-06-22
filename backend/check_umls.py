import spacy
import scispacy
from scispacy.linking import EntityLinker

print("🔄 Loading Medical Model...")
nlp = spacy.load("en_core_sci_sm")

# This step connects your code to the UMLS database
nlp.add_pipe("scispacy_linker", config={"resolve_abbreviations": True, "linker_name": "umls"})

linker = nlp.get_pipe("scispacy_linker")

test_text = "Patient is taking Levothyroxine for hypothyroidism."
doc = nlp(test_text)

print("\n--- Clinical Entities Found ---")
for ent in doc.ents:
    print(f"Entity: {ent.text}")
    for umls_ent in ent._.kb_ents:
        cui = umls_ent[0]
        cui_info = linker.kb.cui_to_entity[cui]
        print(f" > UMLS CUI: {cui}")
        print(f" > Label: {cui_info.canonical_name}")
        print(f" > Semantic Types: {cui_info.types}")
        break