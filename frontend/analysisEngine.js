const BLEEDING_TERMS = ["bleeding", "hemorrhage", "antiplatelet", "anticoagulant", "inr"];
const ENZYME_TERMS = ["cyp", "p450", "metabolism", "inhibition", "induction", "p-glycoprotein"];
const HYPOGLYCEMIA_TERMS = ["hypoglycemia", "blood glucose", "sugar"];
const HYPOTENSION_TERMS = ["hypotension", "blood pressure", "bp lowering", "bradycardia"];
const TOXICITY_TERMS = ["toxicity", "toxic", "arrhythmia", "qt prolongation", "serotonin"];

const HERB_RULES = [
    {
        test: /ginger|garlic|turmeric|curcuma|ginkgo|danshen/,
        tags: ["bleeding"],
        mechanism: "Additive antiplatelet activity can amplify bleeding risk.",
        effect: "Monitor for bruising, bleeding gums, melena, or prolonged bleeding time."
    },
    {
        test: /guggul|guggulu|commiphora/,
        tags: ["enzyme"],
        mechanism: "Induction of hepatic transport and CYP pathways may reduce drug exposure or create variable response.",
        effect: "Watch for loss of therapeutic effect or unstable drug levels."
    },
    {
        test: /guduchi|giloy|neem|aloe|fenugreek|bitter melon|karela|triphala/,
        tags: ["glycemic"],
        mechanism: "Additional glucose-lowering activity may increase hypoglycemia risk.",
        effect: "Monitor fasting glucose, dizziness, tremor, and diaphoresis."
    },
    {
        test: /arjuna|gokshura|ginger/,
        tags: ["hemodynamic"],
        mechanism: "Combined hemodynamic effects may potentiate blood-pressure lowering.",
        effect: "Monitor orthostasis, dizziness, and blood pressure trends."
    }
];

const DRUG_CLASS_RULES = [
    {
        test: /aspirin|warfarin|clopidogrel|prasugrel|ticagrelor|apixaban|rivaroxaban|dabigatran|heparin|enoxaparin|fondaparinux|dalteparin|edoxaban|abciximab|eptifibatide|tirofiban|dipyridamole|cilostazol|ibuprofen|naproxen|diclofenac|celecoxib|meloxicam|indomethacin|ketorolac/,
        tags: ["bleeding"],
        monitoring: "Check for bleeding symptoms and review INR or platelet-effect monitoring when relevant."
    },
    {
        test: /amlodipine|losartan|telmisartan|propranolol|atenolol|beta-blocker|anti-?hypertensive|arb|ace|lisinopril|enalapril|ramipril|captopril|benazepril|valsartan|olmesartan|irbesartan|metoprolol|carvedilol|bisoprolol|nebivolol|nifedipine|diltiazem|verapamil|furosemide|hydrochlorothiazide|spironolactone|clonidine|hydralazine/,
        tags: ["hemodynamic"],
        monitoring: "Track blood pressure, pulse, and symptoms of orthostasis."
    },
    {
        test: /metformin|glimepiride|gliclazide|insulin|antidiabetic|biguanide|sulfonylurea|dpp-4|sglt2|glp-1|thiazolidinedione|sitagliptin|linagliptin|empagliflozin|dapagliflozin|canagliflozin|semaglutide|liraglutide|dulaglutide|exenatide|pioglitazone|rosiglitazone|glipizide|glyburide/,
        tags: ["glycemic"],
        monitoring: "Monitor blood glucose closely and review for hypoglycemia symptoms."
    },
    {
        test: /atorvastatin|rosuvastatin|simvastatin|statin|pravastatin|lovastatin|fluvastatin|pitavastatin|ezetimibe|fibrate|fenofibrate|gemfibrozil|niacin/,
        tags: ["toxicity"],
        monitoring: "Monitor for myalgia, fatigue, and liver-enzyme elevation."
    },
    {
        test: /pantoprazole|omeprazole|rabeprazole|proton pump inhibitor|ppi|lansoprazole|esomeprazole|dexlansoprazole|h2-?receptor|h2-?antagonist|famotidine|ranitidine|cimetidine|nizatidine|antacid/,
        tags: ["absorption"],
        monitoring: "Reassess symptom control and medication response if acid suppression changes."
    },
    {
        test: /fluoxetine|sertraline|citalopram|escitalopram|paroxetine|ssri|snri|venlafaxine|duloxetine|desvenlafaxine|antidepressant|tca|amitriptyline|nortriptyline|mirtazapine|bupropion|trazodone|mao|selegiline/,
        tags: ["toxicity", "serotonin"],
        monitoring: "Monitor for signs of serotonin syndrome (agitation, confusion, tachycardia) or altered mental status."
    },
    {
        test: /carbamazepine|phenytoin|valproic acid|valproate|lamotrigine|levetiracetam|topiramate|gabapentin|pregabalin|anti-?epileptic|anticonvulsant|oxcarbazepine|phenobarbital|primidone|zonisamide/,
        tags: ["toxicity", "enzyme"],
        monitoring: "Monitor drug levels if appropriate and observe for toxicity (dizziness, ataxia, lethargy) or breakthrough seizures."
    },
    {
        test: /amoxicillin|azithromycin|ciprofloxacin|levofloxacin|norfloxacin|ofloxacin|moxifloxacin|antibiotic|penicillin|cephalosporin|macrolide|fluoroquinolone|tetracycline|doxycycline|clindamycin|metronidazole|sulfamethoxazole|trimethoprim/,
        tags: ["absorption", "toxicity", "enzyme"],
        monitoring: "Watch for altered antibiotic efficacy or adverse effects like GI upset, QT prolongation, or secondary infections."
    },
    {
        test: /prednisone|dexamethasone|hydrocortisone|methylprednisolone|corticosteroid|glucocorticoid|steroid/,
        tags: ["glycemic", "hemodynamic"],
        monitoring: "Monitor for increased blood glucose, blood pressure changes, and signs of infection."
    },
    {
        test: /lorazepam|diazepam|alprazolam|clonazepam|midazolam|benzodiazepine|zolpidem|zopiclone|eszopiclone|sedative|hypnotic|barbiturate/,
        tags: ["toxicity"],
        monitoring: "Observe for excessive sedation, respiratory depression, and cognitive impairment."
    },
    {
        test: /haloperidol|risperidone|olanzapine|quetiapine|aripiprazole|clozapine|ziprasidone|paliperidone|antipsychotic|neuroleptic/,
        tags: ["toxicity", "metabolic"],
        monitoring: "Monitor for sedation, extrapyramidal symptoms, QT prolongation, and metabolic changes."
    },
    {
        test: /morphine|codeine|tramadol|oxycodone|hydrocodone|fentanyl|buprenorphine|methadone|opioid|analgesic/,
        tags: ["toxicity"],
        monitoring: "Monitor for respiratory depression, sedation, and constipation."
    },
    {
        test: /levothyroxine|liothyronine|methimazole|propylthiouracil|thyroid/,
        tags: ["endocrine"],
        monitoring: "Monitor TSH and clinical signs of hypo- or hyperthyroidism."
    },
    {
        test: /fluconazole|itraconazole|voriconazole|ketoconazole|terbinafine|antifungal/,
        tags: ["toxicity", "enzyme"],
        monitoring: "Monitor liver function and potential drug interactions."
    },
    {
        test: /amiodarone|sotalol|dofetilide|procainamide|quinidine|antiarrhythmic/,
        tags: ["cardiac"],
        monitoring: "Monitor ECG, QT interval, and signs of arrhythmia or toxicity."
    },
    {
        test: /salbutamol|albuterol|salmeterol|formoterol|budesonide|fluticasone|theophylline|montelukast|bronchodilator|inhaler/,
        tags: ["respiratory"],
        monitoring: "Assess respiratory symptoms, heart rate (for beta-agonists), and therapeutic response."
    },
    {
        test: /tenofovir|lamivudine|emtricitabine|efavirenz|dolutegravir|ritonavir|antiretroviral|protease inhibitor|nucleoside/,
        tags: ["enzyme", "toxicity"],
        monitoring: "Monitor viral response, liver function, renal function, and drug interactions."
    },
    {
        test: /cyclophosphamide|doxorubicin|cisplatin|methotrexate|5-?fluorouracil|imatinib|chemotherapy|anticancer/,
        tags: ["toxicity", "immunosuppression"],
        monitoring: "Monitor blood counts, liver and renal function, and signs of immunosuppression."
    },
    {
        test: /metoclopramide|domperidone|loperamide|prokinetic|antiemetic/,
        tags: ["toxicity"],
        monitoring: "Monitor for extrapyramidal symptoms and cardiac effects when applicable."
    },
    {
        test: /aspirin|ibuprofen|naproxen|diclofenac|celecoxib|meloxicam|indomethacin|ketorolac|sulindac|piroxicam|etoricoxib|aceclofenac|mefenamic acid|ketoprofen/,
        tags: ["bleeding", "renal", "gi"],
        monitoring: "Monitor for GI bleeding, renal function changes, blood pressure elevation, and fluid retention."
    }
];

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function normalizeActionJS(action) {
    const a = String(action || "").toLowerCase().trim();
    if (["inhibitor", "inhibition", "potent inhibitor", "antagonist"].some(x => a.includes(x))) return "INHIBITOR";
    if (["inducer", "induction", "activation", "agonist"].some(x => a.includes(x))) return "INDUCER";
    if (a.includes("substrate")) return "SUBSTRATE";
    return "UNKNOWN";
}

function titleCase(value) {
    return String(value || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    const str1 = String(s1).toLowerCase().replace(/\s+/g, '');
    const str2 = String(s2).toLowerCase().replace(/\s+/g, '');
    if (str1 === str2) return 1.0;
    if (str1.length < 2 || str2.length < 2) return 0;

    const bigrams1 = new Set();
    for (let i = 0; i < str1.length - 1; i++) bigrams1.add(str1.substring(i, i + 2));

    let intersect = 0;
    for (let i = 0; i < str2.length - 1; i++) {
        if (bigrams1.has(str2.substring(i, i + 2))) intersect++;
    }
    return (2 * intersect) / (str1.length + str2.length - 2);
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
}

function splitAliases(value) {
    return uniqueValues(
        String(value || "")
            .split(/[;,/]/)
            .map((part) => normalizeText(part))
            .filter((part) => part.length > 1 && part !== "n a")
    );
}

function severityToBaseScore(severityText) {
    const value = normalizeText(severityText);
    if (!value) return 3;
    if (value.includes("beneficial")) return 1;
    if (value.includes("major")) return 5;
    if (value.includes("moderate high") || value.includes("moderate to severe") || value.includes("moderate to significant")) return 4;
    if (value.includes("mild to moderate") || value.includes("minor moderate") || value.includes("minor to moderate")) return 3;
    if (value.includes("moderate")) return 3;
    if (value.includes("minor") || value.includes("mild")) return 2;
    return 3;
}

function scoreToRiskLabel(score) {
    if (score >= 5) return "Critical";
    if (score === 4) return "High";
    if (score === 3) return "Moderate";
    if (score === 2) return "Low";
    return "Minimal";
}

function scoreToBadgeClass(score) {
    if (score >= 5) return "bg-danger";
    if (score === 4) return "bg-warning text-dark";
    if (score === 3) return "bg-warning text-dark";
    if (score === 2) return "bg-info text-dark";
    return "bg-success";
}

function summarizeEvidence(record) {
    const evidence = String(record.evidence_level || "").trim();
    return evidence || "Database-supported clinical rule";
}

function matchRuleTags(value, rules) {
    const haystack = normalizeText(value);
    return rules
        .filter((rule) => rule.test.test(haystack))
        .flatMap((rule) => rule.tags);
}

function collectHerbProfile(herbName, herbRecords) {
    const herbText = [herbName, ...herbRecords.map((row) => `${row.effect} ${row.mechanism} ${row.drug_class}`)].join(" ");
    const matchedRules = HERB_RULES.filter((rule) => rule.test.test(normalizeText(herbText)));
    return {
        tags: uniqueValues(matchedRules.flatMap((rule) => rule.tags)),
        mechanisms: matchedRules.map((rule) => rule.mechanism),
        effects: matchedRules.map((rule) => rule.effect)
    };
}

function collectDrugProfile(drugName, drugClass) {
    const haystack = `${drugName} ${drugClass}`;
    const matchedRules = DRUG_CLASS_RULES.filter((rule) => rule.test.test(normalizeText(haystack)));
    return {
        tags: uniqueValues(matchedRules.flatMap((rule) => rule.tags)),
        monitoring: uniqueValues(matchedRules.map((rule) => rule.monitoring))
    };
}

function computeRiskScore({ severityText, mechanismText, effectText, age, renalFunction, liverFunction, sourceType }) {
    let score = severityToBaseScore(severityText);
    const text = normalizeText(`${mechanismText} ${effectText}`);

    if (BLEEDING_TERMS.some((term) => text.includes(term))) score = Math.max(score, 4);
    if (TOXICITY_TERMS.some((term) => text.includes(term))) score = Math.max(score, 4);
    if (ENZYME_TERMS.some((term) => text.includes(term))) score = Math.max(score, 3);
    if (HYPOGLYCEMIA_TERMS.some((term) => text.includes(term))) score = Math.max(score, 3);
    if (HYPOTENSION_TERMS.some((term) => text.includes(term))) score = Math.max(score, 3);

    const renal = normalizeText(renalFunction);
    const liver = normalizeText(liverFunction);
    if (renal && renal !== "normal" && /renal|kidney|clearance|nephro/.test(text)) score += 1;
    if (liver && liver !== "normal" && /cyp|hepatic|liver|hepat|metabolism/.test(text)) score += 1;
    if (Number(age) >= 65) score += 1;
    if (sourceType === "Heuristic Inference") score = Math.max(2, score);

    return Math.max(1, Math.min(5, score));
}

function buildPatientSummary(result) {
    if (result.patient_summary && String(result.patient_summary).trim()) {
        return result.patient_summary;
    }

    const risk = result.risk_label.toLowerCase();
    if (result.risk_level >= 5) {
        return `This ${result.herb_name} and ${result.drug_name} combination is high concern and should usually be avoided unless actively supervised by a clinician.`;
    }
    if (result.risk_level === 4) {
        return `This combination may require close monitoring for early signs of harm or loss of effect.`;
    }
    if (result.risk_level === 3) {
        return `This combination should be managed with caution, and therapy should be reassessed if symptoms change.`;
    }
    return `This combination appears lower risk in the current database, but it still deserves careful follow-up and symptom monitoring.`;
}

function buildClinicalRecommendation(result) {
    const recommendation = String(result.recommendation || "").trim();
    if (recommendation) return recommendation;
    if (result.risk_level >= 5) return "Avoid combined use when possible. If use is necessary, closely monitor the patient and revise therapy as soon as any warning signs develop.";
    if (result.risk_level === 4) return "Use cautiously with active monitoring; consider dose adjustment and follow-up for the affected drug.";
    if (result.risk_level === 3) return "Continue with care, document the interaction, and reassess therapy if the patient’s condition changes.";
    return "Document the combination and continue routine monitoring of therapeutic response and side effects.";
}

function inferClinicalCategory(drugProfile, mechanismText, effectText) {
    const normalized = normalizeText(`${mechanismText || ""} ${effectText || ""}`);
    const tags = uniqueValues([...(drugProfile.tags || []), ...normalized.split(/\s+/)]).map((t) => t.toLowerCase());

    if (tags.some((t) => /serotonin|ssri|snri|serotonergic|serotonin syndrome/.test(t))) return "serotonin";
    if (tags.some((t) => /bleed|hemorrhage|anticoagulant|antiplatelet|inr|coagul|clot/.test(t))) return "bleeding";
    if (tags.some((t) => /qt|torsade|arrhythmia|palpit|prolongation/.test(t))) return "qt";
    if (tags.some((t) => /sedation|respiratory|depress|dizziness|cns|somnolence/.test(t))) return "cns";
    if (tags.some((t) => /hypoglyc|blood glucose|sugar|insulin|sulfonylurea/.test(t))) return "glycemic";
    if (tags.some((t) => /hypotension|blood pressure|bp|syncope|hemodynamic/.test(t))) return "hemodynamic";
    if (tags.some((t) => /antibiotic|infection|microbial|azole|rifampin|macrolide|fluoroquinolone/.test(t))) return "antibiotic";
    return "exposure";
}

function getCategoryAssets(category, exposureDirection, herbName, drugName) {
    const increasePrefix = exposureDirection === "increase" ? `This may increase ${drugName} exposure and` : `This may decrease ${drugName} exposure and`;
    const patientIntro = exposureDirection === "increase"
        ? `${herbName} may slow how quickly the body breaks down ${drugName}, which could increase medicine levels and`
        : `${herbName} may speed how quickly the body breaks down ${drugName}, which could lower medicine levels and`;

    switch (category) {
        case "serotonin":
            return {
                clinical: `${increasePrefix} elevate the risk of serotonergic adverse effects such as agitation, tremor, sweating, or insomnia.`,
                monitoring: "Monitor for agitation, tremor, sweating, insomnia, tachycardia, or other signs of serotonin excess.",
                recommendation: "Use cautiously in patients sensitive to serotonergic effects; consider dose adjustment and close monitoring during initiation or titration.",
                patient: `${patientIntro} raise the chance of side effects like agitation, nausea, tremor, or excessive serotonin activity.`
            };
        case "bleeding":
            return {
                clinical: `${increasePrefix} elevate bleeding risk, including bruising, bleeding gums, or gastrointestinal hemorrhage.`,
                monitoring: "Monitor bruising, bleeding gums, melena, or unusual bleeding and review INR or clotting parameters if available.",
                recommendation: "Avoid or closely monitor in patients on anticoagulants or antiplatelets; review clotting status and bleeding signs.",
                patient: `${patientIntro} increase the chance of bleeding, bruising, or extended bleeding from minor cuts.`
            };
        case "qt":
            return {
                clinical: `${increasePrefix} elevate QT prolongation risk and arrhythmia potential.`,
                monitoring: "Monitor palpitations, syncope, dizziness, and consider ECG or QT interval evaluation when appropriate.",
                recommendation: "Use cautiously in patients at risk for QT prolongation; avoid other QT-prolonging agents and consider ECG monitoring.",
                patient: `${patientIntro} raise the chance of heart rhythm changes like palpitations or dizziness.`
            };
        case "cns":
            return {
                clinical: `${increasePrefix} elevate sedation, dizziness, or respiratory depression risk.`,
                monitoring: "Monitor sedation, dizziness, respiratory rate, and alertness.",
                recommendation: "Use cautiously in patients vulnerable to CNS depression; monitor mental status and breathing.",
                patient: `${patientIntro} increase the chance of sleepiness, dizziness, or feeling unusually tired.`
            };
        case "glycemic":
            return {
                clinical: `${increasePrefix} raise the risk of hypoglycemia and unstable blood sugar.`,
                monitoring: "Monitor blood glucose, sweating, tremor, and confusion.",
                recommendation: "Use cautiously in patients at risk for hypoglycemia; monitor glucose and adjust antidiabetic therapy as needed.",
                patient: `${patientIntro} change blood sugar control, which could lead to symptoms like sweating, shaking, or confusion.`
            };
        case "hemodynamic":
            return {
                clinical: `${increasePrefix} raise the risk of hypotension, dizziness, or syncope.`,
                monitoring: "Monitor blood pressure, heart rate, dizziness, and orthostatic symptoms.",
                recommendation: "Use cautiously in patients prone to hypotension; monitor blood pressure and heart rate closely.",
                patient: `${patientIntro} increase the chance of feeling dizzy or faint due to blood pressure changes.`
            };
        case "antibiotic":
            return {
                clinical: `${increasePrefix} reduce antibiotic effectiveness or alter infection control.`,
                monitoring: "Monitor infection signs, gastrointestinal symptoms, and any change in antibiotic response.",
                recommendation: "Use cautiously when co-administering with antibiotics; monitor for reduced efficacy and secondary infections.",
                patient: `${patientIntro} make the antibiotic work less effectively, which could affect infection control.`
            };
        default:
            return {
                clinical: `${increasePrefix} alter drug exposure and may change therapeutic response or side effect potential.`,
                monitoring: "Monitor drug response closely and adjust dose based on effect and tolerability.",
                recommendation: "Monitor therapy response and adjust the dose if clinical effects change.",
                patient: exposureDirection === "increase"
                    ? `${patientIntro} raise the chance of side effects because the medicine may stay in your body longer.`
                    : `${patientIntro} reduce how well the medicine works because it may leave your body faster.`
            };
    }
}

function buildMonitoringAdvice(effectText, drugProfile) {
    const advice = [];
    if (Array.isArray(drugProfile.monitoring)) advice.push(...drugProfile.monitoring);

    const normalizedEffect = normalizeText(effectText);
    const category = inferClinicalCategory(drugProfile, effectText, effectText);
    const assets = getCategoryAssets(category, normalizedEffect.includes("increase") ? "increase" : "decrease", "herb", "drug");
    if (assets && assets.monitoring) advice.push(assets.monitoring);

    if (BLEEDING_TERMS.some((term) => normalizedEffect.includes(term))) advice.push("Review bruising, bleeding gums, melena, and unexplained anemia.");
    if (HYPOGLYCEMIA_TERMS.some((term) => normalizedEffect.includes(term))) advice.push("Check capillary glucose and ask about sweating, tremor, and confusion.");
    if (HYPOTENSION_TERMS.some((term) => normalizedEffect.includes(term))) advice.push("Monitor blood pressure trends and symptoms after standing.");
    if (TOXICITY_TERMS.some((term) => normalizedEffect.includes(term))) advice.push("Review dose-related toxicity symptoms and consider lab monitoring when relevant.");
    return uniqueValues(advice).join(" ");
}

function buildInference(herbName, drugName, herbRecords, drugClass, context, engine) {
    const herbProfile = collectHerbProfile(herbName, herbRecords);
    const drugProfile = collectDrugProfile(drugName, drugClass);
    const canonicalHerb = engine.herbAliasMap.get(normalizeText(herbName)) || herbName;
    const canonicalDrug = engine.drugAliasMap.get(normalizeText(drugName)) || drugName;
    const herbTgtList = engine.herbTargets.get(canonicalHerb) || engine.herbTargets.get(normalizeText(canonicalHerb)) || engine.herbTargets.get(herbName) || engine.herbTargets.get(normalizeText(herbName)) || [];
    const drugTgtList = engine.drugTargets.get(canonicalDrug) || engine.drugTargets.get(normalizeText(canonicalDrug)) || engine.drugTargets.get(drugName) || engine.drugTargets.get(normalizeText(drugName)) || [];

    const sharedTargets = [];
    herbTgtList.forEach((ht) => {
        drugTgtList.forEach((dt) => {
            if (normalizeText(ht.target) !== normalizeText(dt.target)) return;
            const ha = normalizeActionJS(ht.action);
            const da = normalizeActionJS(dt.action);
            const inference = buildMechanisticInference(herbName, drugName, ht.target, ha, da, herbProfile, drugProfile);
            if (inference) {
                sharedTargets.push({ ...inference, target: ht.target, herbAction: ht.action, drugAction: dt.action });
            }
        });
    });

    if (sharedTargets.length === 0) return null;

    sharedTargets.sort((a, b) => b.risk - a.risk);
    const primary = sharedTargets[0];

    const result = {
        herb_name: herbName,
        drug_name: drugName,
        scientific_name: herbRecords[0]?.scientific_name || "",
        common_name: herbRecords[0]?.common_name || "",
        active_ingredients: herbRecords[0]?.active_ingredients || "",
        drug_class: drugClass || herbRecords[0]?.drug_class || "Drug class not mapped",
        enzyme_target: primary.target,
        interaction_type: "Predicted",
        mechanism: primary.mechanism,
        clinical_effect: primary.effect,
        evidence_level: "Predictive KG Inference",
        recommendation: primary.recommendation,
        reference: "",
        source_type: "Predictive KG",
        risk_level: primary.risk,
        risk_label: scoreToRiskLabel(primary.risk),
        badge_class: scoreToBadgeClass(primary.risk)
    };

    result.clinical_recommendation = primary.recommendation || buildClinicalRecommendation(result);
    result.monitoring = primary.monitoring || buildMonitoringAdvice(primary.effect, drugProfile);
    result.patient_summary = primary.patientSummary || buildPatientSummary(result);
    return result;
}

function buildMechanisticInference(herbName, drugName, target, herbAction, drugAction, herbProfile, drugProfile) {
    const targetLabel = target || "the shared metabolic target";
    let mechanism = "";
    let exposureDirection = null;
    let exposureSubject = drugName;
    let exposureObject = drugName;

    if (herbAction === "INHIBITOR" && drugAction === "SUBSTRATE") {
        exposureDirection = "increase";
        mechanism = `${herbName} may inhibit ${targetLabel}-mediated metabolism of ${drugName}, reducing clearance.`;
    } else if (herbAction === "INDUCER" && drugAction === "SUBSTRATE") {
        exposureDirection = "decrease";
        mechanism = `${herbName} may induce ${targetLabel}-mediated metabolism of ${drugName}, increasing clearance.`;
    } else if (herbAction === "INHIBITOR" && drugAction === "INHIBITOR") {
        exposureDirection = "increase";
        mechanism = `${herbName} and ${drugName} may both inhibit ${targetLabel}, amplifying reduction in metabolic capacity.`;
    } else if (herbAction === "INDUCER" && drugAction === "INDUCER") {
        exposureDirection = "decrease";
        mechanism = `${herbName} and ${drugName} may both induce ${targetLabel}, increasing metabolic clearance.`;
    } else if (herbAction === "SUBSTRATE" && drugAction === "INHIBITOR") {
        exposureDirection = "increase";
        exposureSubject = herbName;
        exposureObject = herbName;
        mechanism = `${drugName} may inhibit ${targetLabel}-mediated metabolism of ${herbName}, reducing clearance of herb constituents.`;
    } else if (herbAction === "SUBSTRATE" && drugAction === "INDUCER") {
        exposureDirection = "decrease";
        exposureSubject = herbName;
        exposureObject = herbName;
        mechanism = `${drugName} may induce ${targetLabel}-mediated metabolism of ${herbName}, increasing clearance of herb constituents.`;
    } else {
        return null;
    }

    const category = inferClinicalCategory(drugProfile, mechanism, "");
    const assets = getCategoryAssets(category, exposureDirection, herbName, exposureSubject);
    const riskBase = {
        serotonin: 5,
        bleeding: 5,
        qt: 5,
        cns: 5,
        glycemic: 4,
        hemodynamic: 4,
        antibiotic: 3,
        exposure: 3
    };

    return {
        mechanism,
        effect: assets.clinical,
        recommendation: assets.recommendation,
        monitoring: assets.monitoring,
        patientSummary: assets.patient,
        risk: Math.min(5, Math.max(1, riskBase[category] || 3 + (exposureDirection === "increase" ? 0 : -1)))
    };
}


class AnalysisEngine {
    constructor(records, mappingData, drugAliases, predictiveKgData = []) {
        this.records = records;
        this.mappingData = mappingData || { synonyms: {} };
        this.drugAliasRows = drugAliases || [];
        this.predictiveKgData = predictiveKgData;
        this.herbAliasMap = new Map();
        this.drugAliasMap = new Map();
        this.drugClassMap = new Map();
        this.buildIndexes();
    }

    buildIndexes() {
        // 1. Initial load from Master List
        this.records.forEach((record) => {
            const herbAliases = uniqueValues([
                normalizeText(record.herb_name),
                normalizeText(record.scientific_name),
                ...splitAliases(record.common_name)
            ]);
            herbAliases.forEach((alias) => this.herbAliasMap.set(alias, record.herb_name));

            const drugAliases = uniqueValues([
                normalizeText(record.drug_name),
                ...splitAliases(record.drug_name)
            ]);
            drugAliases.forEach((alias) => {
                this.drugAliasMap.set(alias, record.drug_name);
                if (record.drug_class) this.drugClassMap.set(record.drug_name, record.drug_class);
            });
        });

        // 2. Load from Drug Source Master
        this.drugAliasRows.forEach((row) => {
            const canonical = row.Primary_Name || row.Scientific_Name;
            if (!canonical) return;

            [row.Primary_Name, row.Scientific_Name, row.Common_Name_1, row.Common_Name_2, row.Common_Name_3]
                .map((value) => normalizeText(value))
                .filter(Boolean)
                .forEach((alias) => this.drugAliasMap.set(alias, canonical));
        });

        // 3. Load from Predictive KG (Treating food as herb/botanical)
        this.herbTargets = new Map();
        this.drugTargets = new Map();

        this.predictiveKgData.forEach((row) => {
            const entityStr = row.Entity || row.entity || "";
            const entityNorm = normalizeText(entityStr);
            const type = (row.Type || row.type || "").toLowerCase();
            const target = row.Target || row.target || "";
            const action = row.Action || row.action || "";

            if (!target) return;

            if (type === "herb" || type === "food") {
                if (!this.herbAliasMap.has(entityNorm)) {
                    this.herbAliasMap.set(entityNorm, titleCase(entityStr));
                }
                const canonicalHerb = this.herbAliasMap.get(entityNorm);
                if (!this.herbTargets.has(canonicalHerb)) this.herbTargets.set(canonicalHerb, []);
                this.herbTargets.get(canonicalHerb).push({ target, action });
            } else if (type === "drug" || type === "compound") {
                if (!this.drugAliasMap.has(entityNorm)) {
                    this.drugAliasMap.set(entityNorm, titleCase(entityStr));
                }
                const canonicalDrug = this.drugAliasMap.get(entityNorm);
                if (!this.drugTargets.has(canonicalDrug)) this.drugTargets.set(canonicalDrug, []);
                this.drugTargets.get(canonicalDrug).push({ target, action });
            }
        });

        // 4. Apply Entity Mapping Synonyms (Last, to map to any known entity)
        Object.entries(this.mappingData.synonyms || {}).forEach(([alias, canonical]) => {
            const normalizedAlias = normalizeText(alias);
            const normalizedCanonical = normalizeText(canonical);

            // Check if it's a known herb
            const canonicalHerb = this.herbAliasMap.get(normalizedCanonical);
            if (canonicalHerb) {
                this.herbAliasMap.set(normalizedAlias, canonicalHerb);
            }

            // Check if it's a known drug
            const canonicalDrug = this.drugAliasMap.get(normalizedCanonical);
            if (canonicalDrug) {
                this.drugAliasMap.set(normalizedAlias, canonicalDrug);
            }
        });

        // 5. Final Sort for Extraction
        this.sortedHerbAliases = [...this.herbAliasMap.keys()].sort((a, b) => b.length - a.length);
        this.sortedDrugAliases = [...this.drugAliasMap.keys()].sort((a, b) => b.length - a.length);
    }

    extractEntities(text) {
        const normalized = normalizeText(text);
        const fullTextWithSpaces = ` ${normalized} `;
        const herbs = [];
        const drugs = [];

        // 1. Exact Match Phase (High Confidence)
        this.sortedHerbAliases.forEach((alias) => {
            if (!alias || alias.length < 2) return;
            const pattern = new RegExp(`(^|\\s)${escapeRegex(alias)}(?=\\s|$)`);
            if (pattern.test(fullTextWithSpaces)) herbs.push(this.herbAliasMap.get(alias));
        });

        this.sortedDrugAliases.forEach((alias) => {
            if (!alias || alias.length < 2) return;
            const pattern = new RegExp(`(^|\\s)${escapeRegex(alias)}(?=\\s|$)`);
            if (pattern.test(fullTextWithSpaces)) drugs.push(this.drugAliasMap.get(alias));
        });

        // 2. Fuzzy Match Phase (For catching typos/variations)
        const tokens = normalized.split(/\s+/).filter((t) => t.length > 3);
        const SIMILARITY_THRESHOLD = 0.8;

        tokens.forEach((token) => {
            // Only fuzzy match if token wasn't part of an exact match
            const alreadyMatched = [...herbs, ...drugs].some((e) => normalizeText(e).includes(token));
            if (alreadyMatched) return;

            // Fuzzy match herbs
            for (const alias of this.sortedHerbAliases) {
                if (alias.length < 3) continue;
                if (Math.abs(token.length - alias.length) > 2) continue; // Length pruning
                if (getSimilarity(token, alias) >= SIMILARITY_THRESHOLD) {
                    herbs.push(this.herbAliasMap.get(alias));
                    break;
                }
            }

            // Fuzzy match drugs
            for (const alias of this.sortedDrugAliases) {
                if (alias.length < 3) continue;
                if (Math.abs(token.length - alias.length) > 2) continue; // Length pruning
                if (getSimilarity(token, alias) >= SIMILARITY_THRESHOLD) {
                    drugs.push(this.drugAliasMap.get(alias));
                    break;
                }
            }
        });

        return {
            herbs: uniqueValues(herbs),
            drugs: uniqueValues(drugs)
        };
    }

    findDirectMatches(herbName, drugName) {
        const herbNorm = normalizeText(herbName);
        const drugNorm = normalizeText(drugName);
        const SIMILARITY_THRESHOLD = 0.8;

        return this.records.filter((record) => {
            // Check Herb Match (Exact or Fuzzy)
            const herbAliases = [record.herb_name, record.scientific_name, record.common_name]
                .flatMap((value) => splitAliases(value).concat(normalizeText(value)));
            

            const hMatch = herbAliases.some(alias => {
                if (!alias) return false;
                const sim = getSimilarity(herbNorm, alias);
                return alias === herbNorm || sim >= SIMILARITY_THRESHOLD;
            });

            // Check Drug Match (Exact or Fuzzy)
            const drugAliases = [record.drug_name]
                .flatMap((value) => splitAliases(value).concat(normalizeText(value)));
            
            const dMatch = drugAliases.some(alias => {
                const sim = getSimilarity(drugNorm, alias);
                return alias === drugNorm || sim >= SIMILARITY_THRESHOLD;
            });

            return hMatch && dMatch;
        });
    }

    bestDirectResult(matches, context) {
        const scored = matches.map((record) => {
            const riskLevel = computeRiskScore({
                severityText: record.severity_text,
                mechanismText: record.mechanism,
                effectText: record.effect,
                age: context.age,
                renalFunction: context.renal_function,
                liverFunction: context.liver_function,
                sourceType: "Verified Clinical Data"
            });

            const result = {
                herb_name: record.herb_name,
                drug_name: record.drug_name,
                scientific_name: record.scientific_name,
                common_name: record.common_name,
                active_ingredients: record.active_ingredients,
                drug_class: record.drug_class,
                enzyme_target: record.enzyme_target,
                interaction_type: record.interaction_type,
                mechanism: record.mechanism || record.effect,
                clinical_effect: record.effect,
                evidence_level: summarizeEvidence(record),
                recommendation: record.recommendation,
                reference: record.reference,
                source_type: "Verified Clinical Data",
                risk_level: riskLevel,
                risk_label: scoreToRiskLabel(riskLevel),
                badge_class: scoreToBadgeClass(riskLevel),
                severity_text: record.severity_text
            };
            result.clinical_recommendation = buildClinicalRecommendation(result);
            result.monitoring = buildMonitoringAdvice(result.clinical_effect, collectDrugProfile(result.drug_name, result.drug_class));
            result.patient_summary = buildPatientSummary(result);
            return result;
        });

        scored.sort((a, b) => b.risk_level - a.risk_level);
        return scored[0];
    }

    analyzeText(text, context = {}) {
        const entities = this.extractEntities(text);
        const results = [];
        const seenPairs = new Set();

        entities.herbs.forEach((herbName) => {
            entities.drugs.forEach((drugName) => {
                const pairKey = `${normalizeText(herbName)}::${normalizeText(drugName)}`;
                if (seenPairs.has(pairKey)) return;
                seenPairs.add(pairKey);

                const directMatches = this.findDirectMatches(herbName, drugName);
                if (directMatches.length > 0) {
                    results.push(this.bestDirectResult(directMatches, context));
                    return;
                }

                const herbRecords = this.records.filter((record) =>
                    [record.herb_name, record.scientific_name, record.common_name]
                        .map((value) => normalizeText(value))
                        .includes(normalizeText(herbName))
                );
                const drugClass = this.drugClassMap.get(drugName) || "";
                const inference = buildInference(herbName, drugName, herbRecords, drugClass, context, this);
                if (inference) results.push(inference);
            });
        });

        return {
            classification: entities,
            results
        };
    }
}

function createAnalysisEngine(rows, mappingData, drugAliasRows, predictiveKgRows = []) {
    const records = rows.map((row) => ({
        herb_name: row["Herb Name"] || row.herb || "",
        scientific_name: row["Scientific Name"] || row.scientific || "",
        common_name: row["Common Name"] || row.common || "",
        active_ingredients: row["Active Ingredients"] || row.ingredients || "",
        drug_name: row["Drug Name"] || row.drug || "",
        drug_class: row["Drug Class"] || row.drugClass || "",
        enzyme_target: row["Enzyme Target"] || row.enzyme || "",
        mechanism: row["Mechanism Type"] || row.mechanism || "",
        interaction_type: row["Interaction Type"] || row.interactionType || "",
        effect: row["Clinical Effect"] || row.effect || "",
        severity_text: row["Severity"] || row.severity || "",
        evidence_level: row["Evidence Level"] || row.evidence || "",
        reference: row["Reference"] || row.reference || "",
        recommendation: row["Clinical Recommendation"] || row.recommendation || ""
    })).filter((row) => row.herb_name && row.drug_name);

    return new AnalysisEngine(records, mappingData, drugAliasRows, predictiveKgRows);
}

module.exports = {
    createAnalysisEngine,
    normalizeText,
    scoreToRiskLabel,
    scoreToBadgeClass
};
