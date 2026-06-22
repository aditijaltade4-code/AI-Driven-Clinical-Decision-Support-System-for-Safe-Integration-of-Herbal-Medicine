// clinicalRules.js - The Pharmacy Brain (Synchronized with Python Bridge)

const DRUG_CLASSES = [
    {
        name: 'PPI',
        pattern: /\b(PANTOPRAZOLE|PANTOCID|OMEZ|OMEPRAZOLE|PRILOSEC|RABEPRAZOLE|HAPPI|VELOZ|RANITIDINE|ZANTAC|ESOMEPRAZOLE|NEXIUM)\b/,
        advice: {
            why: "This herb can interfere with stomach acid control, which these medications require to work properly.",
            watch: "Watch for returning heartburn, stomach pain, or unusual muscle cramps (low magnesium).",
            action: "Consult your doctor; long-term use may require monitoring mineral levels."
        }
    },
    {
        name: 'ANTICOAGULANT',
        pattern: /\b(ASPIRIN|ECOSPRIN|DISPRIN|WARFARIN|COUMADIN|CLOPIDOGREL|CLOPILET|PLAVIX|AVIX|APIXABAN|ELIQUIS|RIVAROXABAN|XARELTO|DABIGATRAN|PRADAXA|HEPARIN)\b/,
        advice: {
            why: "The herb may enhance the blood-thinning effect, significantly increasing bleeding risk.",
            watch: "Watch for unusual bruising, nosebleeds, or pink-colored urine.",
            action: "Do not start this herb without a blood clotting test (PT/INR)."
        }
    },
    {
        name: 'STATIN',
        pattern: /\b(ATORVASTATIN|LIPITOR|ROSUVASTATIN|ROSUVAS|CRESTOR|SIMVASTATIN|ZOCOR|PRAVASTATIN|PRAVACHOL)\b/,
        advice: {
            why: "The herb may interfere with how your liver processes cholesterol medicine, potentially causing it to build up.",
            watch: "Watch for unexplained muscle pain, weakness, or tea-colored urine.",
            action: "A liver function test may be needed if you continue this combination."
        }
    },
    {
        name: 'DIABETIC',
        pattern: /\b(METFORMIN|GLYCOMET|GLUCOPHAGE|GLIMEPIRIDE|AMARYL|SITAGLIPTIN|JANUVIA|INSULIN|VILDAGLIPTIN|GALVUS|EMPAGLIFLOZIN|JARDIANCE|DAPAGLIFLOZIN|FORXIGA)\b/,
        advice: {
            why: "This herb can also lower blood sugar, which may cause your medication to drop your sugar too low.",
            watch: "Watch for shakiness, cold sweats, dizziness, or extreme hunger.",
            action: "Monitor your blood glucose more frequently when starting this herb."
        }
    },
    {
        name: 'HYPERTENSION',
        pattern: /\b(AMLODIPINE|AMLOWAS|STAMLO|NORVASC|TELMISARTAN|TELMA|TELVAS|LOSARTAN|LOSAR|LISINOPRIL|PRINIVIL|ZESTRIL|VALSARTAN|DIOVAN|METOPROLOL|LOPRESSOR)\b/,
        advice: {
            why: "This herb may affect your blood pressure or interfere with how your medication relaxes your blood vessels.",
            watch: "Watch for dizziness, lightheadedness when standing up, or a racing heart.",
            action: "Check your blood pressure at home regularly while using this herb."
        }
    },
    {
        name: 'ANTIMICROBIAL',
        pattern: /\b(CIPROFLOXACIN|CIPROX|CIFRAN|ERYTHROMYCIN|CLARITHROMYCIN|KLARICID|FLUCONAZOLE|SYSCAN|ITRACONAZOLE|AMOXICILLIN|AUGMENTIN|AZITHROMYCIN|ZITHROMAX|LEVOFLOXACIN|LEVAQUIN|NORFLOXACIN|OFLOXACIN|MOXIFLOXACIN)\b/,
        advice: {
            why: "This herb can change how fast your body clears this antibiotic/antifungal, potentially making the treatment fail.",
            watch: "Watch for a return of infection symptoms (fever, redness) or unusual nausea.",
            action: "It is best to complete your antibiotic course before starting herbal supplements."
        }
    },
    {
        name: 'NSAID',
        pattern: /\b(DICLOFENAC|VOVERAN|NAPROXEN|IBUPROFEN|BRUFEN|CELECOXIB|CELEBREX|MELOXICAM|MOBIC|INDOMETHACIN|INDOCIN)\b/,
        advice: {
            why: "Both the herb and the medicine can irritate the stomach lining, increasing the risk of ulcers.",
            watch: "Watch for dark, tarry stools or persistent stomach burning.",
            action: "Avoid taking on an empty stomach; discuss with a doctor if you have a history of ulcers."
        }
    },
    {
        name: 'THYROID',
        pattern: /\b(LEVOTHYROXINE|ELTROXIN|THYRONORM|SYNTHROID|LEVOTHROID)\b/,
        advice: {
            why: "This herb may interfere with the absorption of your thyroid medication, altering your hormone levels.",
            watch: "Watch for signs of hyperthyroidism (rapid heartbeat, anxiety) or hypothyroidism (fatigue, weight gain).",
            action: "Separate the herb and medication by at least 4 hours and monitor thyroid levels (TSH) regularly."
        }
    },
    {
        name: 'ANTIDEPRESSANT',
        pattern: /\b(FLUOXETINE|PROZAC|SERTRALINE|ZOLOFT|ESCITALOPRAM|LEXAPRO|CITALOPRAM|CELEXA|AMITRIPTYLINE|ELAVIL|VENLAFAXINE|EFFEXOR|PAROXETINE|PAXIL)\b/,
        advice: {
            why: "Combining this herb with your medication may affect serotonin levels or change how your brain processes the drug.",
            watch: "Watch for agitation, rapid heart rate, confusion, or unusual drowsiness.",
            action: "Do not start this herb without consulting your psychiatrist, as it may increase the risk of serotonin syndrome."
        }
    },
    {
        name: 'ANTICONVULSANT',
        pattern: /\b(PHENYTOIN|DILANTIN|CARBAMAZEPINE|TEGRETOL|VALPROATE|DEPAKOTE|LEVETIRACETAM|KEPPRA|GABAPENTIN|NEURONTIN|LAMOTRIGINE|LAMICTAL)\b/,
        advice: {
            why: "This herb can affect the liver enzymes that clear your seizure medication, potentially lowering its effectiveness.",
            watch: "Watch for a return of seizures, unusual dizziness, or extreme fatigue.",
            action: "Close monitoring of blood medication levels is required if you add this herb."
        }
    },
    {
        name: 'CORTICOSTEROID',
        pattern: /\b(PREDNISONE|DELTASONE|DEXAMETHASONE|DECADRON|HYDROCORTISONE|CORTEF|METHYLPREDNISOLONE|MEDROL)\b/,
        advice: {
            why: "The herb may enhance the side effects of steroids or interfere with your immune system.",
            watch: "Watch for signs of infection, fluid retention, or sudden spikes in blood sugar.",
            action: "Consult your doctor; long-term use with steroids can increase side effects."
        }
    },
    {
        name: 'IMMUNOSUPPRESSANT',
        pattern: /\b(CYCLOSPORINE|NEORAL|SANDIMMUNE|TACROLIMUS|PROGRAF|MYCOPHENOLATE|CELLCEPT|SIROLIMUS|RAPAMUNE)\b/,
        advice: {
            why: "This herb can drastically alter the blood levels of your anti-rejection medication, risking organ rejection or toxicity.",
            watch: "Watch for signs of infection, organ pain, or unusual weakness.",
            action: "Avoid this herb entirely unless explicitly approved by your transplant or specialist team."
        }
    }
];

const HERB_CLASSES = [
    {
        name: 'ENZYME_INDUCER', // e.g., Guggul, St. John's Wort
        pattern: /\b(GUGGUL|GUGGULU|COMMIPHORA|ST JOHN|ST\. JOHN'S WORT|HYPERICUM)\b/,
        mechanism: "This herb speeds up your liver's 'cleaning' system, washing the medicine out too fast."
    },
    {
        name: 'ANTIPLATELET_HERB', // e.g., Garlic, Ginger, Turmeric, Ginkgo
        pattern: /\b(GARLIC|GINGER|TURMERIC|CURCUMIN|HARIDRA|GINKGO|GINKGO BILOBA)\b/,
        mechanism: "This herb has natural blood-thinning properties."
    },
    {
        name: 'GLYCEMIC_HERB', // e.g., Giloy, Neem, Aloe Vera
        pattern: /\b(GILOY|GUDUCHI|NEEM|ALOE VERA|GHRITKUMARI|BITTER MELON|KARELA|FENUGREEK|METHI)\b/,
        mechanism: "This herb has natural blood-sugar lowering effects."
    },
    {
        name: 'SEDATIVE_HERB', // e.g., Ashwagandha, Valerian, Chamomile
        pattern: /\b(ASHWAGANDHA|VALERIAN|CHAMOMILE|KAVA|PASSIONFLOWER|LAVENDER)\b/,
        mechanism: "This herb has natural calming effects that can multiply the drowsiness caused by your medication."
    },
    {
        name: 'STIMULANT_HERB', // e.g., Ginseng, Green Tea, Guarana
        pattern: /\b(GINSENG|GREEN TEA|GUARANA|MACA|YERBA MATE|EPHEDRA|MA HUANG)\b/,
        mechanism: "This herb has stimulating properties that might counteract your medication or increase blood pressure."
    }
];

/**
 * Detects drug class based on your Python Synonym Bridge categories
 */
function getSpecificAdvice(drugName, herbName, res = {}) {
    // 1. Normalize names for matching
    const dName = (drugName || "").toUpperCase();
    const hName = (herbName || "").toUpperCase();
    
    // --- 2. Identify Drug Class ---
    let drugAdvice = null;
    
    // Data-driven iteration over drug classes makes this highly robust and scalable
    for (const dClass of DRUG_CLASSES) {
        if (dClass.pattern.test(dName)) {
            drugAdvice = dClass.advice;
            break;
        }
    }

    // --- 3. Identify Herb Mechanism ---
    let herbMechanism = "This herb may change how your body processes this medicine.";
    
    for (const hClass of HERB_CLASSES) {
        if (hClass.pattern.test(hName)) {
            herbMechanism = hClass.mechanism;
            break;
        }
    }

    // --- 4. Construct Final Response ---
    if (drugAdvice) {
        return {
            summary: "Clinical Alert: Interaction Identified",
            why: `${herbMechanism} ${drugAdvice.why}`,
            watch: drugAdvice.watch,
            action: drugAdvice.action
        };
    }

    // Default Fallback (uses AI-provided severity if available)
    const severityLabel = (res.severity || 'Moderate').toUpperCase();
    return {
        summary: `${severityLabel} Risk Precaution`,
        why: herbMechanism,
        watch: "Watch for any new side effects or changes in how the medicine usually works.",
        action: "Discuss this combination with your pharmacist during your next visit."
    };
}