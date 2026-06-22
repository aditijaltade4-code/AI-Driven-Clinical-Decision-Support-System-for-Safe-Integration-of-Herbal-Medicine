import pandas as pd
import os

# EXPANDED BRAND MAP (CIMS India & 1mg Source)
brand_map = {
    # Antibiotics / Antifungals
    "Amoxicillin": ["Mox", "Amoxil", "Novamox"],
    "Azithromycin": ["Azithral", "Azee", "Zady"],
    "Ciprofloxacin": ["Cifran", "Ciplox", "Zoxan"],
    "Cefixime": ["Taxim-O", "Zifi", "Milixim"],
    "Levofloxacin": ["Loxof", "Levoday", "Glevo"],
    "Metronidazole": ["Flagyl", "Metrogyl", "Aristogyl"],
    "Fluconazole": ["Forcan", "Syscan", "Fluka"],
    
    # Gastrointestinal
    "Pantoprazole": ["Pantocid", "Pan-40", "Pantodac"],
    "Omeprazole": ["Omez", "Omee", "Ocid"],
    "Ranitidine": ["Zinetac", "Rantac", "Aciloc"],
    "Metoclopramide": ["Perinorm", "Reglan"],
    
    # Cardiac / Hypertension
    "Amlodipine": ["Amlokind", "Amlosafe", "Stamlo"],
    "Atorvastatin": ["Lipicure", "Atorva", "Lipitor"],
    "Rosuvastatin": ["Rosuvas", "Razel", "Roseday"],
    "Telmisartan": ["Telma", "Telmikind", "Telsar"],
    "Losartan": ["Cosart", "Losacar", "Repace"],
    "Atenolol": ["Tenormin", "Aten"],
    "Propranolol": ["Inderal", "Ciplar"],
    
    # Diabetes
    "Metformin": ["Glycomet", "Glucophage", "Met-500"],
    "Glimepiride": ["Amaryl", "Glimy", "Euglim"],
    "Gliclazide": ["Diamicron", "Glycinorm", "Reclimet"],
    "Insulin": ["Humalog", "Novolog", "Lantus"],
    
    # Pain / Anti-inflammatory
    "Paracetamol": ["Dolo-650", "Calpol", "Crocin"],
    "Aspirin": ["Ecosprin", "Loprin", "Delisprin"],
    "Diclofenac": ["Voveran", "Voltaren", "Reactin"],
    "Ibuprofen": ["Brufen", "Ibugesic"],
    
    # Others
    "Cetirizine": ["Okacet", "Zyrtec", "Cetzine"],
    "Alprazolam": ["Alprax", "Zolam", "Restyl"],
    "Levothyroxine": ["Thyronorm", "Euthyrox", "Lethrox"],
    "Prednisolone": ["Omnacortil", "Wysolone", "Predone"],
    "Albendazole": ["Zentel", "Bandy", "Noworm"], 
    "Metformin": ["Glycomet", "Glucophage", "Met-500"],
    "Pantoprazole": ["Pantocid", "Pan-40", "Pantodac"],
    "Amoxicillin": ["Mox", "Amoxil", "Novamox"],
    "Amlodipine": ["Amlokind", "Amlosafe", "Stamlo"],
    "Atorvastatin": ["Lipicure", "Atorva", "Lipitor"],
    "Paracetamol": ["Dolo-650", "Calpol", "Crocin"],
    "Clopidogrel": ["Plavix", "Clopivas", "Deplatt"],
    "Azithromycin": ["Azithral", "Azee", "Zady"],
    "Aspirin": ["Ecosprin", "Loprin", "Delisprin"],
    "Telmisartan": ["Telma", "Telmikind", "Telsar"],
    "Furosemide": ["Lasix", "Salurex"],
    "Diclofenac": ["Voveran", "Voltaren", "Reactin"],
    "Omeprazole": ["Omez", "Omee", "Ocid"],
    "Glimepiride": ["Amaryl", "Glimy", "Euglim"],
    "Losartan": ["Cosart", "Losacar", "Repace"],
    "Cetirizine": ["Okacet", "Zyrtec", "Cetzine"],
    "Alprazolam": ["Alprax", "Zolam", "Restyl"],# ADD THESE TO YOUR EXISTING brand_map
    "Ciprofloxacin": ["Cifran", "Ciplox", "Zoxan"],
    "Cefixime": ["Taxim-O", "Zifi", "Milixim"],
    "Levofloxacin": ["Loxof", "Levoday", "Glevo"],
    "Metronidazole": ["Flagyl", "Metrogyl", "Aristogyl"],
    "Ranitidine": ["Zinetac", "Rantac", "Aciloc"],
    "Albendazole": ["Zentel", "Bandy", "Noworm"],
    "Fluconazole": ["Forcan", "Syscan", "Fluka"],
    "Atropine": ["Atropin", "Myatro", "Atrul"],
    "Diazepam": ["Valium", "Calmpose", "Lumbax"],
    "Lorazepam": ["Ativan", "Larpose", "Lopez"],
    "Phenytoin": ["Eptoin", "Dilantin", "Phenytal"],
    "Carbamazepine": ["Tegritol", "Mazetol", "Zen"],
    "Insulin": ["Humalog", "Novolog", "Lantus"],
    "Gliclazide": ["Diamicron", "Glycinorm", "Reclimet"],
    "Simvastatin": ["Simvotin", "Simcard", "Zocor"],
    "Rosuvastatin": ["Rosuvas", "Razel", "Roseday"],
    "Warfarin": ["Uniwarfin", "Coumadin"],
    "Enoxaparin": ["Lovenox", "Clexane", "Lonopin"],
    "Levothyroxine": ["Thyronorm", "Euthyrox", "Lethrox"],
    "Prednisolone": ["Omnacortil", "Wysolone", "Predone"]
}

def update_original_file():
    target_file = 'Drug_Source_Master.csv'
    
    if not os.path.exists(target_file):
        print(f"Error: {target_file} not found!")
        return

    # Load original
    df = pd.read_csv(target_file)
    print(f"Updating {target_file} with {len(brand_map)} brand mappings...")

    count = 0
    for index, row in df.iterrows():
        generic = row['Primary_Name']
        
        if generic in brand_map:
            brands = brand_map[generic]
            df.at[index, 'Common_Name_1'] = brands[0] if len(brands) > 0 else row['Common_Name_1']
            df.at[index, 'Common_Name_2'] = brands[1] if len(brands) > 1 else row['Common_Name_2']
            df.at[index, 'Common_Name_3'] = brands[2] if len(brands) > 2 else row['Common_Name_3']
            count += 1

    # Overwrite the original file
    df.to_csv(target_file, index=False)
    print(f"Successfully updated {count} drugs in 'Drug_Source_Master.csv'.")

if __name__ == "__main__":
    update_original_file()