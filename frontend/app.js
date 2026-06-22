/* ---------------------------------------------------
    1. GLOBAL CONFIG & STATE (CONSOLIDATED)
---------------------------------------------------*/
const NODE_URL = "http://127.0.0.1:3000"; 
const AI_URL = "";
let cyInstance = null;
let GLOBAL_BRIDGE = {}; // This is the "Translator" for BioBERT
let masterData = [];    // This holds your 367 CSV rules

// FIX: Ensure these are EMPTY so old data doesn't persist
let incidenceData = {
    labels: [], 
    minor: [],
    moderate: [],
    severe: []
};

// This function pulls the REAL clock time from the user's computer
const getTodayLabel = () => {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// --- NEW KG RESOLVER ---
// Place this at the top level of app.js
function resolveKGNodes(res) {
    return {
        herb: res.herb_name || "Unknown Herb",
        // Extracting specific constituent from model output
        phytochemical: res.phytochemical || res.active_constituent || "Active Compounds", 
        // Mapping the specific enzyme/transporter found by the model
        pathway: res.enzyme_target || res.target || "General Metabolic Pathway",
        // Logic for the direction arrow
        direction: (res.interaction_type || "").toLowerCase().includes("inhib") ? "Inhibits" : "Induces",
        drug: res.drug_name || "Target Medication"
    };
}

/* ---------------------------------------------------
    NEW: INITIALISE MAPPING (Fixed for entity_mapping.json)
---------------------------------------------------*/
async function checkEngineStatus() {
    const aiStatus = document.getElementById('aiStatus');
    const dbStatus = document.getElementById('dbSyncStatus');

    try {
        // Step A: Log the attempt
        console.log("📡 Pinging Bridge at:", `${NODE_URL}/api/mapping`);
        
        const response = await fetch(`${NODE_URL}/api/mapping`);
        
        if (response.ok) {
            const mappingData = await response.json(); 
            
            // Step B: Robust mapping (Handles both {synonyms:{}} and flat JSON)
            GLOBAL_BRIDGE = mappingData.synonyms || mappingData || {}; 
            
            // Step C: Update UI
            if (aiStatus) {
                aiStatus.innerText = "ENGINE: ONLINE";
                aiStatus.className = "badge bg-success w-100 py-2 animate__animated animate__pulse";
            }
            if (dbStatus) {
                dbStatus.innerText = "SYNCED";
                dbStatus.style.background = "#10b981";
            }
            
            console.log("✅ Sync Success:", Object.keys(GLOBAL_BRIDGE).length, "terms mapped.");
        } else {
            throw new Error(`Server Error: ${response.status}`);
        }
    } catch (err) {
        console.error("❌ Connection Failed:", err.message);
        if (aiStatus) {
            aiStatus.innerText = "ENGINE: OFFLINE";
            aiStatus.className = "badge bg-danger w-100 py-2";
        }
    }
}

/* ---------------------------------------------------
    2. ENGINE LOGIC (Similarity & Scoring)
---------------------------------------------------*/
function getSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().replace(/\s+/g, '');
    const s2 = str2.toLowerCase().replace(/\s+/g, '');
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;
    const bigrams1 = new Set();
    for (let i = 0; i < s1.length - 1; i++) bigrams1.add(s1.substring(i, i + 2));
    let intersect = 0;
    for (let i = 0; i < s2.length - 1; i++) {
        if (bigrams1.has(s2.substring(i, i + 2))) intersect++;
    }
    return (2 * intersect) / (s1.length + s2.length - 2);
}

function getSafetyScore(severity) {
    const s = severity.toUpperCase();
    if (s.includes("CRITICAL") || s.includes("HIGH") || s.includes("SEVERE")) 
        return { score: 25, label: "CRITICAL", class: "bg-danger" };
    if (s.includes("MODERATE") || s.includes("WARN") || s.includes("MEDIUM")) 
        return { score: 60, label: "CAUTION", class: "bg-warning text-dark" };
    return { score: 95, label: "LOW RISK", class: "bg-success" };
}

function calculateDynamicSeverity(baseSeverity, enzymeTarget) {
    const liverStatus = (document.getElementById('liverStatus')?.value || "Normal").toLowerCase();
    const renalStatus = (document.getElementById('renalStatus')?.value || "Normal").toLowerCase();
    const age = parseInt(document.getElementById('patientAge')?.value || 0);
    
    let finalSeverity = (baseSeverity || "Moderate").toUpperCase();

    // 1. HARDENED LIVER CHECK (Fuzzy match for 'impaired' or 'failure')
    const hasLiverIssue = liverStatus.includes("impaired") || liverStatus.includes("failure") || liverStatus.includes("cirrhosis");
    const isEnzymePath = enzymeTarget.toUpperCase().includes("CYP") || enzymeTarget.toUpperCase().includes("P450");

    if (hasLiverIssue && isEnzymePath) {
        if (finalSeverity === "MODERATE") finalSeverity = "HIGH";
        else if (finalSeverity === "LOW") finalSeverity = "MODERATE";
    }

    // 2. HARDENED RENAL CHECK
    if (renalStatus.includes("failure") || renalStatus.includes("impaired")) {
        if (!finalSeverity.includes("HIGH")) finalSeverity = "HIGH (CRITICAL)";
    }

    // 3. CLINICAL AGE STANDARDS (Updated to 60 for Geriatric)
    if (age >= 60) {
        if (finalSeverity === "LOW") finalSeverity = "MODERATE";
        else if (finalSeverity === "MODERATE") finalSeverity = "HIGH";
        
        if (!finalSeverity.includes("GERIATRIC")) finalSeverity += " (GERIATRIC RISK)";
    }
    
    return finalSeverity;
}

/* ---------------------------------------------------
    3. GRAPH VISUALIZATION (CSV Loader Fix)
---------------------------------------------------*/
/* ---------------------------------------------------
    3. GRAPH VISUALIZATION (PREDICTIVE KG INTEGRATED)
---------------------------------------------------*/
function transformDataToGraph(data) {
    const elements = [];
    const addedNodes = new Set();
    const addedEdges = new Set();

    const formatName = (str) => {
        if (!str) return "Unknown";
        const s = str.toString().trim();
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    };

    data.forEach(item => {
        let h_raw = item['herb'] || item['herb_name'] || "Unknown";
        let d_raw = item['drug'] || item['drug_name'] || "Unknown";
        
        const h = formatName(h_raw);
        const d = formatName(d_raw);
        const hId = h.toLowerCase();
        const dId = d.toLowerCase();
        const severity = (item['severity'] || item['Severity'] || "Moderate").toUpperCase();

        if (h !== "Unknown" && d !== "Unknown") {
            // 1. ADD BASE NODES
            if (!addedNodes.has(hId)) {
                elements.push({ data: { id: hId, label: h, type: 'herb' } });
                addedNodes.add(hId);
            }
            if (!addedNodes.has(dId)) {
                elements.push({ data: { id: dId, label: d, type: 'drug' } });
                addedNodes.add(dId);
            }

            // --- 2. LOGIC BRIDGE (Predictive vs Direct) ---
            const rawPath = item['Enzyme Target'] || item['Mechanism Type'] || "";

            if (rawPath && rawPath !== "N/A" && rawPath !== "") {
                const enzymes = rawPath.split(/[;,]/).map(e => e.trim());

                enzymes.forEach(enzyme => {
                    const enz = enzyme.toUpperCase();
                    const enzId = `enz_${enz.toLowerCase().replace(/\s+/g, '_')}`;

                    // Add Bridge Node (The Diamond)
                    if (!addedNodes.has(enzId)) {
                        elements.push({ 
                            data: { id: enzId, label: enz, type: 'mechanism' } 
                        });
                        addedNodes.add(enzId);
                    }

                    // --- DASHED AI EDGES (Must stay inside this loop!) ---
                    // Herb to Enzyme
                    elements.push({ 
                        data: { 
                            source: hId, 
                            target: enzId, 
                            type: 'pathway',
                            isAI: 'true',
                            severity: severity 
                        } 
                    });

                    // Enzyme to Drug
                    elements.push({ 
                        data: { 
                            source: enzId, 
                            target: dId, 
                            type: 'pathway',
                            isAI: 'true',
                            severity: severity 
                        } 
                    });
                });
            } else {
                // 3. DIRECT INTERACTION (The Solid Line)
                const edgeId = `${hId}-${dId}`;
                if (!addedEdges.has(edgeId)) {
                    elements.push({ 
                        data: { 
                            id: edgeId,
                            source: hId, 
                            target: dId, 
                            severity: severity, 
                            type: 'direct',
                            isAI: item.source_type === 'AI' ? 'true' : 'false'
                        } 
                    });
                    addedEdges.add(edgeId);
                }
            }
        }
    });
    return elements;
}
window.loadGraph = async function(specificData = null) {
    const container = document.getElementById('cy');
    if (!container) return;

    // --- FIX 1: DECLARE dataToUse AT TOP SCOPE ---
    let dataToUse = []; 

    container.style.height = "350px"; 
    container.style.marginBottom = "20px";

    // --- FIX 2: IMPROVED DATA FETCHING LOGIC ---
    if (specificData && specificData.length > 0) { 
        dataToUse = specificData; 
        console.log("📊 Graph: Using AI specific data results.");
    } else {
        try {
           const response = await fetch(`${NODE_URL}/api/list-all`);
            const json = await response.json();
            // Fallback chain to find the data array
            dataToUse = json.data || (Array.isArray(json) ? json : []);
        } catch (e) { 
            console.error("❌ Knowledge Graph Fetch Error:", e);
            dataToUse = []; 
        }
    }

    // Safety check: don't initialize if there's nothing to show
    if (!dataToUse || dataToUse.length === 0) {
        console.warn("⚠️ No data available for Knowledge Graph.");
        return;
    }

    // --- FIX 3: CYTOSCAPE INITIALIZATION WITH VISUAL INTELLIGENCE ---
    cyInstance = cytoscape({
        container: container,
        elements: transformDataToGraph(dataToUse),
        
        style: [
            // Base Node Style
            { 
                selector: 'node', 
                style: { 
                    'label': 'data(label)', 
                    'color': '#1e293b', 
                    'font-size': '10px', 
                    'text-valign': 'bottom', 
                    'text-margin-y': '6px',
                    'text-halign': 'center',
                    'width': 22, 
                    'height': 22, 
                    'background-color': '#cbd5e1',
                    'font-weight': '600'
                } 
            },
            // Specific Node Branding
            { selector: 'node[type="herb"]', style: { 'background-color': '#10b981', 'shape': 'ellipse' } },
            { selector: 'node[type="drug"]', style: { 'background-color': '#3b82f6', 'shape': 'round-rectangle' } },
            { 
                selector: 'node[type="mechanism"], node[type="pathway"]', 
                style: { 
                    'background-color': '#f59e0b', 
                    'shape': 'diamond',
                    'width': 30,
                    'height': 30 
                } 
            },
            // Edge/Connection Logic
            { 
                selector: 'edge', 
                style: { 
                    'width': 2, 
                    'curve-style': 'bezier', 
                    'opacity': 0.6,
                    'line-color': '#94a3b8',
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': '#94a3b8'
                } 
            },
            // MAJOR Severity = THICK RED
            { 
                selector: 'edge[severity="MAJOR"], edge[severity="Major"]', 
                style: { 
                    'line-color': '#ef4444', 
                    'target-arrow-color': '#ef4444',
                    'width': 4,
                    'opacity': 1 
                } 
            },
            // AI PREDICTIONS = DASHED GOLD
            { 
                selector: 'edge[isAI="true"], edge[type="pathway"]', 
                style: { 
                    'line-style': 'dashed', 
                    'line-dash-pattern': [4, 4],
                    'line-color': '#f59e0b',
                    'target-arrow-color': '#f59e0b'
                } 
            }
        ],

        layout: { 
            name: 'cose', 
            animate: true,
            refresh: 20,
            fit: true, 
            padding: 40,
            nodeRepulsion: 12000, // <--- HIGHER Repulsion stops the overlapping cloud
            idealEdgeLength: 120,
            gravity: 80 
        }
    });

    cyInstance.ready(() => {
        cyInstance.fit();
        cyInstance.center();
    });
};

/* ---------------------------------------------------
    4. CLINICAL ENGINE: Search & Render Logic (FIXED)
---------------------------------------------------*/
// HELPER: Generates a patient-friendly version of the clinical data
function getPatientMessage(severity, herb, drug) {
    const sev = severity.toUpperCase();
    if (sev === 'MAJOR' || sev === 'HIGH') {
        return `This combination is **unsafe**. Taking ${herb} and ${drug} together could cause a serious medical reaction. **Do not combine them** without a doctor's permission.`;
    } else if (sev === 'MODERATE') {
        return `${herb} might change how ${drug} works in your body. You should watch for side effects and tell your doctor you are taking both.`;
    } else {
        return `It is generally okay to use ${herb} and ${drug}, but they might have a small effect on each other. Inform your doctor to be safe.`;
    }
}
// HELPER: Finds a value in an object regardless of case or hidden spaces in keys
function getFlexValue(item, possibleKeys, fallback = "N/A") {
    const itemKeys = Object.keys(item);
    // Lowercase everything for a perfect "Waterfall" match
    const normalizedKeys = possibleKeys.map(k => k.trim().toLowerCase());
    
    for (const key of itemKeys) {
        if (normalizedKeys.includes(key.trim().toLowerCase())) {
            return item[key];
        }
    }
    return fallback;
}
function highlightEntities(text, herbs, drugs) {
    let highlighted = text;
    // Highlight Herbs in Green
    herbs.forEach(h => {
        const reg = new RegExp(`\\b(${h})\\b`, 'gi');
        highlighted = highlighted.replace(reg, '<mark class="bg-success text-white px-1 rounded">$1</mark>');
    });
    // Highlight Drugs in Blue
    drugs.forEach(d => {
        const reg = new RegExp(`\\b(${d})\\b`, 'gi');
        highlighted = highlighted.replace(reg, '<mark class="bg-primary text-white px-1 rounded">$1</mark>');
    });
    
    // Create or Update a display div behind/above your textarea
    const display = document.getElementById('highlightOverlay');
    if(display) display.innerHTML = highlighted;
}
/* ---------------------------------------------------
    5. CANONICAL FUNCTIONS ARE IN overrides.js
    runManualCheck, renderManualResult, runDeepAI,
    exportClinicalReport, saveToHistory, renderHistory
    — All defined there. Do NOT redefine here.
---------------------------------------------------*/

function renderManualResult(match, container) {
    // 1. DYNAMIC DATA PREP
    const s = calculateDynamicSeverity(match.severity || "Moderate", match.enzyme || "");
    const uniqueId = `mode-${Math.random().toString(36).substr(2, 9)}`;

    // Advice logic for Patient View
    const pData = typeof getSpecificAdvice === 'function' 
        ? getSpecificAdvice(match.drug, match.herb, match) 
        : { 
            summary: "Potential interaction detected.", 
            why: "Metabolic pathway conflict.", 
            watch: "Side effects related to medication levels.", 
            action: "Consult your healthcare provider before combining." 
        };

    // Reference/DOI Link Logic
    let rawRef = (match.reference || "#").toString().trim();
    let finalLink = rawRef;
    let linkText = "Research Reference";

    if (rawRef !== "#") {
        if (!rawRef.startsWith('http')) {
            const cleanDoi = rawRef.replace(/^doi:\s*/i, "").replace(/\s/g, "");
            finalLink = `https://doi.org/${cleanDoi}`;
            linkText = `View DOI: ${cleanDoi}`;
        }
    }

    // 2. CONSTRUCT HTML (With Clinical & Patient Views)
    container.innerHTML = `
        <div class="card p-3 mb-2 border-start-verified shadow-sm animate__animated animate__fadeIn">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <h6 class="fw-bold mb-0 text-dark" style="font-size: 14px;">${match.herb.toUpperCase()} + ${match.drug.toUpperCase()}</h6>
                    <small class="text-muted" style="font-size: 10px;">${match.scientific || 'Species data verified'}</small>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggle-${uniqueId}">
                    <label class="form-check-label x-small fw-bold text-muted" for="toggle-${uniqueId}" style="font-size: 9px;">PATIENT VIEW</label>
                </div>
            </div>

            <div id="clinician-view-${uniqueId}">
                <div class="mb-2">
                    <span class="badge ${s.toLowerCase().includes('major') || s.toLowerCase().includes('high') || s.toLowerCase().includes('critical') ? 'bg-danger' : (s.toLowerCase().includes('low') ? 'bg-success' : 'bg-warning text-dark')}" style="font-size: 9px;">${s.toUpperCase()}</span>
                    <span class="badge bg-light text-dark border" style="font-size: 9px;">Evidence: ${match.evidence || 'B'}</span>
                </div>
                <p class="small mb-1" style="font-size: 12px;"><strong>Clinical Effect:</strong> ${match.effect}</p>
                <p class="small mb-1" style="font-size: 12px;"><strong>Mechanism:</strong> ${match.mechanism} (${match.intType || 'Pharmacokinetic'})</p>
                <p class="small mb-2 text-primary fw-bold" style="font-size: 12px;"><strong>Recommendation:</strong> ${match.recommendation}</p>
                
                <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <a href="${finalLink}" target="_blank" class="x-small text-decoration-none text-primary ${finalLink === "#" ? 'd-none' : ''}" style="font-size: 10px;">
                        <i class="fas fa-book-medical me-1"></i> ${linkText}
                    </a>
                    <span class="x-small text-muted" style="font-size: 9px;">Enzyme: ${match.enzyme || 'N/A'}</span>
                </div>
            </div>

            <div id="patient-view-${uniqueId}" class="d-none" style="border-left: 4px solid #0dcaf0; padding: 12px; background-color: #f0f9ff; border-radius: 0 8px 8px 0;">
                <p class="small mb-1"><strong>What is the risk?</strong> <span class="text-muted">${pData.summary}</span></p>
                <p class="small mb-1"><strong>What to watch for?</strong> <span class="text-muted">${pData.watch}</span></p>
                <div class="p-2 bg-white border rounded mt-2">
                    <p class="small mb-0 text-danger" style="font-size: 11.5px;"><strong>What to do:</strong> ${pData.action}</p>
                </div>
            </div>
        </div>
    `;

    // 3. TOGGLE INTERACTIVITY
    const checkbox = container.querySelector(`#toggle-${uniqueId}`);
    const clinicianDiv = container.querySelector(`#clinician-view-${uniqueId}`);
    const patientDiv = container.querySelector(`#patient-view-${uniqueId}`);
    const cardElement = container.querySelector('.card');

    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            clinicianDiv.classList.add('d-none');
            patientDiv.classList.remove('d-none');
            cardElement.style.borderLeft = "5px solid #0dcaf0";
        } else {
            clinicianDiv.classList.remove('d-none');
            patientDiv.classList.add('d-none');
            cardElement.style.borderLeft = ""; // Reverts to CSS default
        }
    });
};

/* runDeepAI is defined in overrides.js — do not redefine here */
window._appjs_placeholder2_ = async function() {
    console.log("🚀 Step 1: Initializing Waterfall Scan...");
    const textInput = document.getElementById('clinicalNoteInput').value;
    const resultArea = document.getElementById('aiResultArea');

    if (!textInput.trim()) return alert("Please enter clinical notes for analysis.");

    // UI Loading State
    resultArea.innerHTML = `
        <div class="p-4 text-center">
            <div class="spinner-border text-primary mb-2" role="status"></div>
            <p class="fw-bold mb-0">Executing Waterfall Match...</p>
            <small class="text-muted">CSV -> Knowledge Graph -> Clinical Mapping</small>
        </div>`;

    try {
        // 1. DATA FETCHING
        const response = await fetch(`${NODE_URL}/api/list-all`);
        const result = await response.json();

        // Ensure masterData is available globally without re-declaring const
        masterData = result.data || [];
        console.log(`✅ Step 1: ${masterData.length} records extracted.`);
        const lowerInput = textInput.toLowerCase();
      
        // 2. NORMALIZATION & BRIDGE (IMPROVED FOR MULTI-WORD MAPPING)
        const cleanInput = lowerInput.replace(/[^\w\s,]/g, ""); 
        const rawTokens = cleanInput.split(/[\s,]+/).filter(t => t.length > 2);

        const normalizedTokens = rawTokens.map(token => {
            const t = token.toLowerCase().trim();
            
            // Use the Entity Mapping JSON (GLOBAL_BRIDGE)
            for (let key in GLOBAL_BRIDGE) {
                const lowerKey = key.toLowerCase();
                if (t === lowerKey || t.includes(lowerKey)) {
                    console.log(`bridge: Mapping '${t}' to '${GLOBAL_BRIDGE[key]}'`);
                    return GLOBAL_BRIDGE[key].toLowerCase(); 
                }
            }
            return t;
        });

        // REMOVE DUPLICATES: If "Tinospora cordifolia" is mapped twice, we only need one token
        const uniqueTokens = [...new Set(normalizedTokens)];
        console.log("🧪 AI Layer Tokens:", uniqueTokens);

        // ---3 UPDATED WATERFALL MATCHING (Line ~600) ---
        let findings = [];
        const stopWords = ["taking", "patient", "with", "and", "from", "using", "the"];
        // FIX: Ensure we use the uniqueTokens from the bridge mapping
        const cleanTokens = uniqueTokens.filter(t => t.length > 2 && !stopWords.includes(t));

        masterData.forEach(row => {
            // Grab all possible name variations from your CSV
            const herbName = getFlexValue(row, ['Herb Name', 'herb'], "").toLowerCase().trim();
            const scientific = getFlexValue(row, ['Scientific Name', 'scientific'], "").toLowerCase().trim();
            const drugName = getFlexValue(row, ['Drug Name', 'drug'], "").toLowerCase().trim();
            const drugClass = getFlexValue(row, ['Drug Class', 'drug class'], "").toLowerCase().trim();

            const herbMatch = cleanTokens.some(token => 
                (herbName.length > 2 && (herbName.includes(token) || token.includes(herbName) || getSimilarity(token, herbName) >= 0.8)) || 
                (scientific.length > 2 && (scientific.includes(token) || token.includes(scientific) || getSimilarity(token, scientific) >= 0.8))
            );
            
            const drugMatch = cleanTokens.some(token => 
                (drugName.length > 2 && (drugName.includes(token) || token.includes(drugName) || getSimilarity(token, drugName) >= 0.8)) || 
                (drugClass.length > 2 && drugClass.includes(token))
            );

            if (herbMatch && drugMatch) {
                console.log(`🎯 MATCH FOUND: ${herbName} + ${drugName}`);
                findings.push(row);
            }
        });

        // CRITICAL: Update the Knowledge Graph with the findings
        if (findings.length > 0) {
            window.loadGraph(findings); 
        }

        // 4. UI RENDERING & VISUALIZATION SYNC
        resultArea.innerHTML = ""; // Clear loading state

        if (findings.length === 0) {
            resultArea.innerHTML = `
                <div class="alert alert-info shadow-sm animate__animated animate__fadeIn">
                    <i class="fas fa-info-circle me-2"></i>No interaction found in the clinical database and none predicted through the Knowledge Graph. Please monitor the patient and report any adverse effects. (Extracted herbs: none detected. Extracted drugs: none detected)
                </div>`;
        } else {
            const headerElement = document.createElement('h6');
            headerElement.className = "fw-bold mb-3 text-secondary px-2";
            headerElement.innerHTML = `<i class="fas fa-microscope me-2"></i>ANALYSIS RESULTS`;
            resultArea.appendChild(headerElement);
            
            const uniqueKeys = new Set();
            const graphPayload = []; // To collect all matches for a single graph update

            findings.forEach(item => {
                const formattedData = {
                    herb: (item["Herb Name"] || item["herb"] || "Unknown Herb").toUpperCase(),
                    drug: (item["Drug Name"] || item["drug"] || "Unknown Drug").toUpperCase(),
                    scientific: item["Scientific Name"] || item["scientific"] || "",
                    severity: item["Severity"] || item["severity"] || "Moderate",
                    effect: item["Clinical Effect"] || item["effect"] || "No clinical data available.",
                    recommendation: item["Clinical Recommendation"] || item["recommendation"] || "Monitor patient closely.",
                    evidence: item["Evidence Level"] || item["evidence"] || "B",
                    reference: item["Reference"] || item["reference"] || "#",
                    mechanism: item["Mechanism Type"] || item["mechanism"] || "Pharmacological interaction",
                    enzyme: item["Enzyme Target"] || item["enzyme"] || ""
                };

                const key = `${formattedData.herb}-${formattedData.drug}`.toLowerCase();
                
                if (!uniqueKeys.has(key)) {
                    uniqueKeys.add(key);
                    graphPayload.push(formattedData); 

                    // --- 1. RENDER INTERACTIVE CARD ---
                    const cardWrapper = document.createElement('div');
                    cardWrapper.className = "interaction-card-wrapper mb-3";
                    
                    if (typeof renderManualResult === 'function') {
                        renderManualResult(formattedData, cardWrapper); 
                    }
                    resultArea.appendChild(cardWrapper);

                    // --- 2. LOG TO HISTORY ---
                    if (typeof saveToHistory === 'function') {
                        saveToHistory({
                            herb: formattedData.herb,
                            drug: formattedData.drug,
                            severity: formattedData.severity,
                            mechanism: formattedData.mechanism,
                            clinicalEffect: formattedData.effect,
                            recommendation: formattedData.recommendation,
                            monitoring: formattedData.monitoring || '',
                            patientSummary: formattedData.patientSummary || formattedData.patient_summary || '',
                            sourceType: formattedData.source_type || formattedData.sourceType || 'AI Scan',
                            reference: formattedData.reference || '',
                            riskLevel: formattedData.risk_level || formattedData.riskLevel || null,
                            risk_label: formattedData.risk_label || formattedData.severity || '',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            });

            // --- 3. THE "LIVE" SYNC TRIGGERS ---
            if (window.loadGraph && graphPayload.length > 0) {
                console.log("🎨 Updating Knowledge Graph with AI results...");
                window.loadGraph(graphPayload);
            }

            if (typeof window.loadDashboard === 'function') {
                console.log("📊 Syncing Dashboard charts...");
                window.loadDashboard();
            }

            headerElement.innerHTML = `<i class="fas fa-microscope me-2"></i>ANALYSIS RESULTS (${uniqueKeys.size})`;
        }
    } catch (err) {
        console.error("❌ Waterfall Error:", err);
        resultArea.innerHTML = `
            <div class="alert alert-danger shadow-sm">
                <i class="fas fa-exclamation-triangle me-2"></i>Analysis Connection Error.
            </div>`;
    };
};

/* renderAIResults — legacy stub (not used by current overrides flow) */
function renderAIResults(results) {
    console.log("[STUB] renderAIResults: use renderDynamicResults in overrides.js", results[0]);
    const resultArea = document.getElementById('aiResultArea');
    if (!resultArea) return;
    resultArea.innerHTML = "";
    const kgDataForGraph = [];

    results.forEach((res, index) => {
        // --- 1. DATA SYNC (Incidence & Insights Fix) ---
        const sev = (res.severity || 'Moderate').toUpperCase();
        const effect = res.clinical_effect || res.effect || "AI Analysis performed";

        if (typeof saveToHistory === 'function') {
            saveToHistory({
                herb: res.herb_name || "Unknown Herb",
                drug: res.drug_name || "Unknown Drug",
                severity: sev,
                mechanism: res.mechanism || "",
                clinicalEffect: res.clinical_effect || res.effect || effect,
                recommendation: res.clinical_recommendation || res.recommendation || "",
                monitoring: res.monitoring || "",
                patientSummary: res.patient_summary || res.patientSummary || "",
                sourceType: res.source_type || res.sourceType || "AI Scan",
                reference: res.reference || "",
                riskLevel: resolveRiskLevel(res),
                risk_label: res.risk_label || sev,
                timestamp: new Date().toISOString()
            });
        }

        // --- 2. PREPARE UI VARIABLES ---
        const patientAge = parseInt(document.getElementById('patientAge')?.value || 0);
        const patientMode = document.getElementById('patientMode')?.value || "NORMAL";
        
        let displaySev = sev;
        if (patientAge >= 60 || patientMode === "GERIATRIC") {
            displaySev = "MAJOR";
        }
        
        const badgeClass = displaySev === 'MAJOR' ? 'bg-danger' : 'bg-warning text-dark';
        const uniqueId = res.id || `ai-${Math.random().toString(36).substr(2, 5)}-${index}`;

        // Border & Badge Logic
        let sourceBadge = "";
        let borderClass = "border-start-ai";
        const sourceType = (res.source_type || "").toLowerCase();

        if (sourceType.includes("verified") || sourceType.includes("clinical") || res.evidence_level) {
            sourceBadge = `<span class="badge bg-success-light text-success">✅ CLINICAL RECORD</span>`;
            borderClass = "border-start-verified";
        } else {
            sourceBadge = `<span class="badge bg-info-light text-info">📡 KG PREDICTION</span>`;
        }

        // Reference Resolver
        let rawRef = (res.doi || res.reference || "").toString().trim();
        let finalLink = "#";
        let linkText = "Research Link Not Found";
        if (rawRef !== "" && rawRef !== "#") {
            const cleanDoi = rawRef.replace(/^doi:\s*/i, "").replace(/\s/g, "");
            finalLink = rawRef.startsWith('http') ? rawRef : `https://doi.org/${cleanDoi}`;
            linkText = rawRef.startsWith('http') ? "View Reference" : `View DOI: ${cleanDoi}`;
        }

        // Advice logic
        const pData = typeof getSpecificAdvice === 'function' 
            ? getSpecificAdvice(res.drug_name, res.herb_name, res) 
            : { summary: "Consult your doctor.", why: "N/A", watch: "N/A", action: "N/A" };

      // --- 3. CONSTRUCT THE CARD (HYBRID KG INTEGRATION) ---

// 1. Map the data (You already have this part)
const kg = (typeof resolveKGNodes === 'function') 
    ? resolveKGNodes(res) 
    : { herb: res.herb_name, phytochemical: "Compound", pathway: "CYP450", drug: res.drug_name, direction: "Interaction" };

// 2. THE FIX: Push this result into your collection array
kgDataForGraph.push(kg); // <--- ADD THIS LINE RIGHT HERE

// 3. Create the UI Card (The rest of your code)
const card = document.createElement('div');
card.className = `p-3 mb-3 bg-white rounded border shadow-sm ${borderClass} animate__animated animate__fadeInUp`;

        // HYBRID LOGIC: If source is Verified/Clinical, show text. Otherwise, show the KG Graph.
        const mechanismSection = (sourceType.includes("verified") || sourceType.includes("clinical"))
            ? `<p class="small mb-1" style="font-size: 12px;"><strong>Clinical Effect:</strong> ${res.clinical_effect || res.effect || "Review clinical parameters."}</p>
               <p class="small mb-1" style="font-size: 12px;"><strong>Mechanism:</strong> ${res.mechanism}</p>`
            : `<div class="kg-flow-viz my-3 p-2 rounded border-0" style="background: #f1f5f9;">
                <div class="d-flex justify-content-between align-items-center text-center px-1">
                    <div class="kg-node">
                        <small class="d-block text-muted" style="font-size:7px;">HERBAL ENTITY</small>
                        <span class="fw-bold" style="font-size:11px;">${kg.herb}</span>
                    </div>
                    <i class="fas fa-chevron-right text-primary" style="font-size:8px;"></i>
                    <div class="kg-node">
                        <small class="d-block text-muted" style="font-size:7px;">PHYTOCHEMICAL</small>
                        <span class="fw-bold text-primary" style="font-size:11px;">${kg.phytochemical}</span>
                    </div>
                    <i class="fas fa-chevron-right text-info" style="font-size:8px;"></i>
                    <div class="kg-node">
                        <small class="d-block text-muted" style="font-size:7px;">PATHWAY</small>
                        <span class="fw-bold text-info" style="font-size:11px;">${kg.pathway}</span>
                    </div>
                    <i class="fas fa-chevron-right text-danger" style="font-size:8px;"></i>
                    <div class="kg-node">
                        <small class="d-block text-muted" style="font-size:7px;">DRUG TARGET</small>
                        <span class="fw-bold text-danger" style="font-size:11px;">${kg.drug}</span>
                    </div>
                </div>
                <div class="text-center mt-2 border-top pt-1">
                    <span class="badge bg-white text-dark border p-1" style="font-size:9px;">
                        Relationship: Predicted ${kg.direction} of ${kg.pathway}
                    </span>
                </div>
            </div>`;

        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <h6 class="fw-bold mb-0" style="color:#1e293b; font-size: 14px;">
                        ${res.herb_name.toUpperCase()} + ${res.drug_name.toUpperCase()}
                    </h6>
                    <small class="text-muted" style="font-size: 10px;">
                        ${res.scientific_name || res.scientific || 'Species data pending'}
                    </small>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggle-${uniqueId}">
                    <label class="form-check-label x-small fw-bold text-muted" for="toggle-${uniqueId}" style="font-size: 9px;">PATIENT MODE</label>
                </div>
            </div>
            <div id="clinician-view-${uniqueId}">
                <div class="mb-2">
                    <span class="badge ${badgeClass}" style="font-size: 10px;">${displaySev}</span>
                    <span class="badge bg-light text-dark border" style="font-size: 10px;">Evidence: ${res.evidence_level || res.evidence || 'C'}</span>
                    ${sourceBadge}
                </div>
                
                ${mechanismSection} 

                <p class="small mb-2 text-primary fw-bold" style="font-size: 12px;"><strong>Recommendation:</strong> ${res.clinical_recommendation || res.recommendation}</p>
                <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <a href="${finalLink}" target="_blank" class="x-small text-decoration-none text-primary ${finalLink === "#" ? 'd-none' : ''}" style="font-size: 10.5px;">
                        <i class="fas fa-book-medical me-1"></i> ${linkText}
                    </a>
                    <span class="x-small text-muted" style="font-size: 9px;">Target: ${res.enzyme_target || 'General'}</span>
                </div>
            </div>
            <div id="patient-view-${uniqueId}" class="d-none" style="border-left: 4px solid #0dcaf0; padding: 12px; background-color: #f0f9ff; border-radius: 4px;">
                <p class="small mb-1"><strong>What is the risk?</strong> <span class="text-muted">${pData.summary}</span></p>
                <p class="small mb-1"><strong>What to watch for?</strong> <span class="text-muted">${pData.watch}</span></p>
                <div class="p-2 bg-white border rounded mt-2">
                    <p class="small mb-0 text-danger" style="font-size: 11.5px;"><strong>Action:</strong> ${pData.action}</p>
                </div>
            </div>
        `;
        // --- 4. TOGGLE EVENT LISTENER ---
        const toggle = card.querySelector(`#toggle-${uniqueId}`);
        const cView = card.querySelector(`#clinician-view-${uniqueId}`);
        const pView = card.querySelector(`#patient-view-${uniqueId}`);

        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                cView.classList.add('d-none');
                pView.classList.remove('d-none');
                card.style.borderLeft = "4px solid #0dcaf0"; 
            } else {
                cView.classList.remove('d-none');
                pView.classList.add('d-none');
                card.style.borderLeft = ""; 
            }
        });

        resultArea.appendChild(card);
    });
// --- 5. FINAL REFRESH TRIGGER ---
    // 1. Refresh Charts
    if (typeof window.loadDashboard === 'function') {
        window.loadDashboard();
    }

    // 2. Refresh Knowledge Graph Side-Panel
    if (typeof window.loadGraph === 'function' && kgDataForGraph.length > 0) {
        console.log("🎨 Syncing Knowledge Graph UI...");
        window.loadGraph(kgDataForGraph);
    }
}

/* exportClinicalReport is defined canonically in overrides.js — stub only */
window._export_appjs_stub_ = function() {
    const resultArea = document.getElementById('aiResultArea');
    const patientName = document.getElementById('patientNameInput')?.value || "Patient_Record";

    if (!resultArea || !resultArea.textContent || !resultArea.textContent.trim()) {
        alert("No clinical data to export. Please run a scan first.");
        return;
    }

    // Create a background clone so the live UI doesn't "jump" or expand
    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.top = '0';
    printContainer.style.left = '0';
    printContainer.style.opacity = '0';
    printContainer.style.pointerEvents = 'none';
    printContainer.style.zIndex = '-1';
    printContainer.style.width = '800px'; 
    printContainer.style.background = 'white';

    const contentClone = resultArea.cloneNode(true);
    
    // Remove all buttons from the PDF so it looks like a professional document
    contentClone.querySelectorAll('button, .btn, .nav-tabs').forEach(el => el.remove());

    // Force hidden blocks to be visible in export.
    contentClone.querySelectorAll('.collapse, .d-none').forEach(el => {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
    });

    printContainer.innerHTML = `
        <div style="padding: 40px; font-family: sans-serif; border: 1px solid #eee;">
            <h2 style="color: #0d6efd; border-bottom: 2px solid #0d6efd; padding-bottom: 10px;">Clinical Interaction Report</h2>
            <p><strong>Patient:</strong> ${patientName} | <strong>Date:</strong> ${new Date().toLocaleString()}</p>
            <div style="margin-top: 20px;">${contentClone.innerHTML}</div>
        </div>
    `;

    document.body.appendChild(printContainer);

    const opt = {
        margin: 0.5,
        filename: `Clinical_Report_${patientName}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    setTimeout(() => {
        html2pdf().set(opt).from(printContainer).save().then(() => {
            document.body.removeChild(printContainer);
        });
    }, 1000);
};

/* ---------------------------------------------------
    6. ANALYTICS: Trend Tracking & AI Insights
---------------------------------------------------*/

function initAnalytics(historyData) {
const ctx = document.getElementById('timeSeriesChart').getContext('2d');
    
    // 1. Time-Series Chart Implementation
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], // X-axis: Dates
            datasets: [
                {
                    label: 'High Risk',
                    data: [2, 5, 3, 8, 4, 10, 7],
                    borderColor: '#ef4444', // Red
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Moderate',
                    data: [10, 15, 8, 12, 20, 18, 25],
                    borderColor: '#f59e0b', // Orange
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } },
            scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
        }
    });

    // 2. AI Insight Generator
    renderAIInsights();
}

function renderAIInsights(dynamicInsights) {
    const insightArea = document.getElementById('aiInsightList');
    
    // UNIVERSAL FALLBACKS: Applies to all clinical scenarios
    const fallbackInsights = [
        { 
            type: 'info', 
            icon: 'fa-shield-alt', 
            text: 'Governance: All identified interactions should be cross-referenced with patient-specific renal and hepatic function.' 
        },
        { 
            type: 'info', 
            icon: 'fa-clipboard-check', 
            text: 'Standard of Care: Ensure all herbal supplements are documented in the patient’s formal Medication Administration Record (MAR).' 
        },
        { 
            type: 'info', 
            icon: 'fa-user-md', 
            text: 'Clinical Best Practice: Monitor for therapeutic failure or unexpected toxicity when starting or stopping herbal adjuncts.' 
        }
    ];

    const displayData = (dynamicInsights && dynamicInsights.length > 0) 
                        ? dynamicInsights 
                        : fallbackInsights;

   insightArea.innerHTML = displayData.map(i => {
        // Map 'info' to 'primary' so Bootstrap colors work
        const colorType = i.type === 'info' ? 'primary' : i.type;
        
        return `
        <div class="d-flex align-items-start mb-3 p-3 rounded bg-white shadow-sm border-start border-4 border-${colorType} animate__animated animate__fadeInRight">
            <div class="insight-icon-container me-3" style="background: rgba(0,0,0,0.05); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                <i class="fas ${i.icon} text-${colorType} fa-lg"></i>
            </div>
            <div>
                <strong class="text-uppercase small d-block text-${colorType}">
                    ${i.type === 'danger' ? 'Critical Alert' : 'Clinical Guidance'}
                </strong>
                <span class="small text-dark fw-medium">${i.text}</span>
            </div>
        </div>
    `}).join('');
}

// --- ADD TO THE BOTTOM OF APP.JS ---

/* saveToHistory and renderHistory are defined canonically in dashboard.js
   and MUST NOT be redefined here. Stubs only. */
function _saveToHistory_REMOVED(herb, drug, severity, result) {
    console.log(`History Saved: ${herb} + ${drug} (${severity})`);
    let history = JSON.parse(localStorage.getItem('hdi_history')) || [];
    
    const newEntry = {
        // FIX: Store the full ISO string so the dashboard can extract the date AND time
        timestamp: new Date().toISOString(), 
        // FIX: Store a display-friendly time for the "Recent Scans" list
        displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        herb: herb,
        drug: drug,
        severity: severity.toUpperCase(), // Ensure consistency (e.g., MAJOR)
        summary: result.substring(0, 45) + "..."
    };

    history.unshift(newEntry);
    if (history.length > 10) history.pop(); 

    localStorage.setItem('hdi_history', JSON.stringify(history));
    
    // 1. Refresh the local list in the sidebar
    renderHistory(); 

    // 2. TRIGGER DASHBOARD SYNC: Forces the charts to update immediately
    if (typeof loadDashboard === 'function') {
        loadDashboard(); 
    }
}

function _renderHistory_REMOVED() {
    const list = document.getElementById('historyList');
    const data = JSON.parse(localStorage.getItem('hdi_history')) || [];
    if (!list) return;
    
    list.innerHTML = data.length ? data.map(item => {
        // 1. Check for Major severity (case-insensitive)
        const isMajor = (item.severity || "").toUpperCase().includes('MAJOR') || 
                        (item.severity || "").toUpperCase().includes('SEVERE');
        
        // 2. Extract time only for the UI (using displayTime if available, otherwise fallback)
        const timeDisplay = item.displayTime || (item.timestamp.includes('T') 
                            ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                            : item.timestamp);
        
        return `
            <div class="p-2 border-bottom x-small animate__animated animate__fadeIn">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold" style="font-size: 11px; color: #1e293b;">
                        ${item.herb.toUpperCase()} + ${item.drug.toUpperCase()}
                    </span>
                    <span class="text-muted" style="font-size: 9px;">${timeDisplay}</span>
                </div>
                <div class="badge ${isMajor ? 'bg-danger' : 'bg-warning text-dark'} x-tiny" style="font-size: 8px; font-weight: 700;">
                    ${item.severity.toUpperCase()}
                </div>
            </div>
        `;
    }).join('') : '<p class="text-center text-muted x-small mt-3">No scans yet.</p>';
}

// Clear History Function 
function clearHistory() {
    if(confirm("Clear all scan history?")) {
        localStorage.removeItem('hdi_history');
        renderHistory();
    }
}

// History is loaded by dashboard.js and overrides.js DOMContentLoaded handlers
/* ---------------------------------------------------
    UTILITY: CHART RENDERING ENGINE
---------------------------------------------------*/
function updateIncidenceChart() {
    const ctx = document.getElementById('incidenceChart');
    if (!ctx) return; // Exit if the canvas isn't on the page yet

    // Destroy existing chart to prevent memory leaks and "flickering"
    if (window.myIncidenceChart) {
        window.myIncidenceChart.destroy();
    }

    // Create the fresh chart instance
    window.myIncidenceChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: incidenceData.labels,
            datasets: [
                {
                    label: 'Severe',
                    data: incidenceData.severe,
                    borderColor: '#dc3545', // var(--high-risk)
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Moderate',
                    data: incidenceData.moderate,
                    borderColor: '#f39c12', // var(--mod-risk)
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Minor',
                    data: incidenceData.minor,
                    borderColor: '#27ae60', // var(--low-risk)
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { boxWidth: 12, font: { size: 11, weight: 'bold' } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#64748b' },
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    ticks: { color: '#64748b' },
                    grid: { display: false }
                }
            }
        }
    });
}
// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 DOM fully loaded. Starting Engine Check...");
    
    // 1. Run it IMMEDIATELY so the badge turns green right away
    checkEngineStatus(); 

    // 2. Then set it to repeat every 30 seconds
    setInterval(checkEngineStatus, 30000); 

    // OCR / Prescription Upload Listener
    const prescriptionUpload = document.getElementById('prescriptionUpload');
    if (prescriptionUpload) {
        prescriptionUpload.addEventListener('change', handlePrescriptionUpload);
    }
});

/* ---------------------------------------------------
    NEW: OCR & FUZZY CLEANING LAYER
---------------------------------------------------*/

async function handlePrescriptionUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const ocrStatus = document.getElementById('ocrStatus');
    const ocrProgress = document.getElementById('ocrProgress');
    const noteInput = document.getElementById('clinicalNoteInput');

    if (ocrStatus) ocrStatus.classList.remove('d-none');
    if (ocrProgress) ocrProgress.innerText = "Initializing OCR Engine...";

    try {
        let extractedText = "";

        if (file.type === "application/pdf") {
            if (ocrProgress) ocrProgress.innerText = "Processing PDF Pages...";
            extractedText = await extractTextFromPDF(file, ocrProgress);
        } else {
            if (ocrProgress) ocrProgress.innerText = "Scanning Image...";
            const result = await Tesseract.recognize(file, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text' && ocrProgress) {
                        ocrProgress.innerText = `Scanning: ${Math.round(m.progress * 100)}%`;
                    }
                }
            });
            extractedText = result.data.text;
        }

        if (ocrProgress) ocrProgress.innerText = "Applying Fuzzy Correction...";
        const cleanedText = applyFuzzyCleaning(extractedText);

        if (noteInput) {
            noteInput.value = cleanedText;
            noteInput.dispatchEvent(new Event('input'));
        }

        if (ocrProgress) ocrProgress.innerText = "Scan Complete!";
        setTimeout(() => {
            if (ocrStatus) ocrStatus.classList.add('d-none');
            runDeepAI(); 
        }, 1500);

    } catch (err) {
        console.error("OCR Error:", err);
        if (ocrProgress) ocrProgress.innerText = "Error: OCR Failed.";
        setTimeout(() => {
            if (ocrStatus) ocrStatus.classList.add('d-none');
        }, 5000);
    }
}

async function extractTextFromPDF(file, progressEl) {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        if (progressEl) progressEl.innerText = `Rendering PDF Page ${i}/${pdf.numPages}...`;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const image = canvas.toDataURL('image/png');

        if (progressEl) progressEl.innerText = `Scanning Page ${i}/${pdf.numPages}...`;
        const result = await Tesseract.recognize(image, 'eng');
        fullText += result.data.text + "\n";
    }
    return fullText;
}

function applyFuzzyCleaning(text) {
    if (!text) return "";
    const terms = Object.keys(GLOBAL_BRIDGE);
    if (terms.length === 0) return text;

    let words = text.split(/[\s,.;:()]+/);
    let cleanedText = text;

    words.forEach(word => {
        if (word.length < 4) return;
        let bestMatch = null;
        let bestScore = 0;

        terms.forEach(term => {
            if (term.length < 4) return;
            const score = getSimilarity(word, term);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = term;
            }
        });

        if (bestScore >= 0.8 && bestScore < 1.0) {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedWord}\\b`, 'g');
            cleanedText = cleanedText.replace(regex, bestMatch);
        }
    });

    return cleanedText;
}
