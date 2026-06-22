# --- 1. SYNONYM BRIDGE ---
SYNONYM_BRIDGE = {
    # Cardiovascular / Hypertension
    "amlodipine": "Amlodipine", "amlowas": "Amlodipine", "stamlo": "Amlodipine", "norvasc": "Amlodipine",
    "telmisartan": "Telmisartan", "telma": "Telmisartan", "telvas": "Telmisartan",
    "losartan": "Losartan", "losar": "Losartan",
    "rosuvastatin": "Rosuvastatin", "rosuvas": "Rosuvastatin", "crestor": "Rosuvastatin",
    "warfarin": "Warfarin", "coumadin": "Warfarin",
    "aspirin": "Aspirin", "ecosprin": "Aspirin", "disprin": "Aspirin",
    "clopidogrel": "Clopidogrel", "clopilet": "Clopidogrel", "avix": "Clopidogrel", "plavix": "Clopidogrel",
    "digoxin": "Digoxin", "lanoxin": "Digoxin",

    # Diabetes / Glycemic Control
    "metformin": "Metformin", "glycomet": "Metformin", "cetapin": "Metformin", "glucophage": "Metformin",
    "glimepiride": "Glimepiride", "amaryl": "Glimepiride", "glimipride": "Glimepiride",
    "sitagliptin": "Sitagliptin", "januvia": "Sitagliptin", 
    "insulin": "Insulin", 
    "pioglitazone": "Pioglitazone", "piosys": "Pioglitazone",
    "vildagliptin": "Vildagliptin", "galvus": "Vildagliptin",
    
    # Gastric / Proton Pump Inhibitors
    "pantoprazole": "Pantoprazole", "pantocid": "Pantoprazole", "pan": "Pantoprazole", "pan-d": "Pantoprazole", "omez": "Pantoprazole", 
    "omeprazole": "Omeprazole", "prilosec": "Omeprazole","omez": "Omeprazole",
    "ranitidine": "Ranitidine", "zantac": "Ranitidine", "acinorm": "Ranitidine",
    "rabeprazole": "Rabeprazole", "happi": "Rabeprazole", "veloz": "Rabeprazole",

    # Antibiotics / Antifungals
    "ciprofloxacin": "Ciprofloxacin", "ciprox": "Ciprofloxacin", "cifran": "Ciprofloxacin",
    "erythromycin": "Erythromycin", "erythrocin": "Erythromycin",
    "clarithromycin": "Clarithromycin", "klaricid": "Clarithromycin",
    "fluconazole": "Fluconazole", "syscan": "Fluconazole", "zocon": "Fluconazole",
    "itraconazole": "Itraconazole", "itrasys": "Itraconazole", "canditral": "Itraconazole",

    # Herbs
    "ashwagandha": "Ashwagandha", "asvagandha": "Ashwagandha", "withania": "Ashwagandha",
    "guggulu": "Guggulu", "guggul": "Guggulu", "commiphora": "Guggulu", "guggulsterone": "Guggul",
    "brahmi": "Brahmi", "bacopa": "Brahmi",
    "shatavari": "Shatavari", "asparagus racemosus": "Shatavari",
    "tulsi": "Tulsi", "basil": "Tulsi", "ocimum": "Tulsi",
    "triphala": "Triphala", "amla": "Triphala", "haritaki": "Triphala", "bibhitaki": "Triphala",
    "giloy": "Giloy", "guduchi": "Giloy", "tinospora": "Giloy",
    "neem": "Neem", "azadirachta": "Neem",
    "aloe vera": "Aloe Vera", "ghritkumari": "Aloe Vera",
    "ginger": "Ginger", "shunti": "Ginger", "zingiber": "Ginger",
    "garlic": "Garlic", "lasuna": "Garlic", "allium": "Garlic",
    "punarnava": "Punarnava", "boerhavia": "Punarnava",
    "gokshura": "Gokshura", "tribulus": "Gokshura" ,
    "turmeric": "Turmeric", 
    "curcumin": "Turmeric", 
    "haridra": "Turmeric", 
    "haldi": "Turmeric",
    "curcuma longa": "Turmeric",
}

# --- 2. HERB CATEGORIZATION LIST ---
KNOWN_HERBS_LIST = [
    "Ashwagandha", "Guggulu", "Curcumin", "Brahmi", "Shatavari", 
    "Tulsi", "Triphala", "Giloy", "Neem", "Aloe Vera", "Ginger", 
    "Garlic", "Kalmegh", "Punarnava", "Gokshura", "Shankhpushpi"
]

# In config_utils.py
BLACKLIST = {
    "patient", "presents", "taking", "history", "clinical", "with", 
    "daily", "prescribed", "male", "female", "report", "showed", 
    "results", "blood", "test", "show", "given", "observed", "tablet", "capsule",
    "and", "the", "for", "was", "has", "is", "are", "were", "been", "using",
    "uchi", "gud", "take", "takes", "took", "from", "this", "that", "dose", "dosage",
    "hospital", "clinic", "morning", "evening", "night", "status", "active",
    "user", "also", "extract", "mg", "while", "consumes"
}

# --- 4. T5 BRAIN CONFIGURATION ---
T5_CONFIG = {
    "max_length": 150,
    "num_beams": 5,
    "repetition_penalty": 2.5,
    "early_stopping": True,
    "no_repeat_ngram_size": 2,
    "eos_token_id": 1,
    "pad_token_id": 0,
    "decoder_start_token_id": 0
}