window.lastClinicalAnalysis = null;

function resolveRiskLevel(result) {
    const numeric = Number(result.risk_level || result.riskLevel || 0);
    if (numeric >= 1 && numeric <= 5) return numeric;

    const severity = String(result.severity || result.risk_label || "").toLowerCase();
    if (severity.includes("critical") || severity.includes("major")) return 5;
    if (severity.includes("high") || severity.includes("severe")) return 4;
    if (severity.includes("moderate")) return 3;
    if (severity.includes("low") || severity.includes("minor")) return 2;
    return 3;
}

function riskMeta(level) {
    if (level >= 5) return { label: "Critical", badgeClass: "bg-danger", borderClass: "border-start-verified" };
    if (level === 4) return { label: "High", badgeClass: "bg-warning text-dark", borderClass: "border-start-verified" };
    if (level === 3) return { label: "Moderate", badgeClass: "bg-primary", borderClass: "border-start-ai" };
    if (level === 2) return { label: "Low", badgeClass: "bg-info text-dark", borderClass: "border-start-ai" };
    return { label: "Minimal", badgeClass: "bg-success", borderClass: "border-start-ai" };
}

function getSimilarity(str1, str2) {
    const s1 = String(str1 || "").toLowerCase().replace(/\s+/g, '');
    const s2 = String(str2 || "").toLowerCase().replace(/\s+/g, '');
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;
    const bigrams = new Set();
    for (let i = 0; i < s1.length - 1; i++) bigrams.add(s1.substring(i, i + 2));
    let intersect = 0;
    for (let i = 0; i < s2.length - 1; i++) {
        if (bigrams.has(s2.substring(i, i + 2))) intersect++;
    }
    return (2 * intersect) / (s1.length + s2.length - 2);
}

function normalizeSearch(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fuzzyMatchTerms(valueA, valueB) {
    const a = normalizeSearch(valueA);
    const b = normalizeSearch(valueB);
    if (!a || !b) return false;
    if (a.includes(b) || b.includes(a)) return true;
    return getSimilarity(a, b) >= 0.75;
}

function resultReferenceLink(result) {
    const rawRef = (result.reference || result.doi || "").toString().trim();
    if (!rawRef) return { href: "", text: "" };
    if (rawRef.startsWith("http")) return { href: rawRef, text: "View Reference" };

    const cleanDoi = rawRef.replace(/^doi:\s*/i, "").replace(/\s/g, "");
    return { href: `https://doi.org/${cleanDoi}`, text: `View DOI: ${cleanDoi}` };
}

function buildPatientBlock(result) {
    const advice = typeof getSpecificAdvice === "function"
        ? getSpecificAdvice(result.drug_name, result.herb_name, result)
        : null;

    return {
        summary: result.patient_summary || advice?.summary || "Potential herb-drug interaction identified.",
        why: advice?.why || result.mechanism || result.clinical_effect || "Mechanism under review.",
        watch: advice?.watch || result.monitoring || "Monitor for new symptoms, toxicity, or change in therapeutic effect.",
        action: advice?.action || result.clinical_recommendation || "Discuss the combination with a clinician before continuing it long-term."
    };
}

function renderClinicalCard(result, index) {
    const riskLevel = resolveRiskLevel(result);
    const risk = riskMeta(riskLevel);
    const patientBlock = buildPatientBlock(result);
    const ref = resultReferenceLink(result);
    const uniqueId = `dynamic-${index}-${Math.random().toString(36).slice(2, 7).replace(/[^a-z0-9_-]/g, "-")}`;
    const sourceText = result.source_type || "Dynamic Analysis";

    const patientAge = parseInt(document.getElementById("patientAge")?.value || "0", 10);
    const baseSeverity = result.risk_label || result.severity || "Moderate";
    const adjustedSeverity = (typeof window.calculateDynamicSeverity === "function")
        ? window.calculateDynamicSeverity(baseSeverity, result.enzyme_target || result.enzyme || "")
        : baseSeverity;
    const isGeriatric = patientAge >= 60 || adjustedSeverity.toUpperCase().includes("GERIATRIC");
    const geriatricBadge = isGeriatric
        ? `<span class="badge bg-warning text-dark ms-1" style="font-size:9px;"><i class="fas fa-user-clock me-1"></i>GERIATRIC RISK</span>`
        : "";

    // Elevate risk label for geriatric patients
    const displayRiskLevel = isGeriatric ? Math.min(5, riskLevel + 1) : riskLevel;
    const displayRisk = riskMeta(displayRiskLevel);

    return `
        <div class="p-3 mb-3 bg-white rounded border shadow-sm clinical-result-card ${displayRisk.borderClass}">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <h6 class="fw-bold mb-0" style="color:#1e293b; font-size:14px;">
                        ${(result.herb_name || "Unknown Herb").toUpperCase()} + ${(result.drug_name || "Unknown Drug").toUpperCase()}
                    </h6>
                    <small class="text-muted" style="font-size:10px;">
                        ${result.scientific_name || result.drug_class || "Clinical pair analysis"}
                    </small>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="toggle-${uniqueId}">
                    <label class="form-check-label x-small fw-bold text-muted" for="toggle-${uniqueId}" style="font-size: 9px;">PATIENT MODE</label>
                </div>
            </div>

            <div id="clinician-view-${uniqueId}">
                <div class="mb-2 d-flex flex-wrap gap-1">
                    <span class="badge ${displayRisk.badgeClass}" style="font-size:10px;">Risk ${displayRiskLevel}/5</span>
                    <span class="badge bg-light text-dark border" style="font-size:10px;">${displayRisk.label}</span>
                    <span class="badge bg-secondary" style="font-size:10px;">${sourceText}</span>
                    <span class="badge bg-light text-dark border" style="font-size:10px;">${result.evidence_level || "Dynamic Evidence"}</span>
                    ${geriatricBadge}
                </div>

                <p class="small mb-1" style="font-size:12px;"><strong>Clinical Effect:</strong> ${result.clinical_effect || "No effect text available."}</p>
                <p class="small mb-1" style="font-size:12px;"><strong>Mechanism:</strong> ${result.mechanism || "Mechanism under review."}</p>
                <p class="small mb-1" style="font-size:12px;"><strong>Monitoring:</strong> ${result.monitoring || "Monitor symptoms and response."}</p>
                <p class="small mb-2 text-primary fw-bold" style="font-size:12px;"><strong>Recommendation:</strong> ${result.clinical_recommendation || result.recommendation || "Consult a healthcare provider."}</p>
                <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <span class="x-small text-muted" style="font-size:9px;">Target: ${result.enzyme_target || "General pathway"}</span>
                    ${ref.href ? `<a href="${ref.href}" target="_blank" class="x-small text-decoration-none text-primary" style="font-size: 10.5px;"><i class="fas fa-book-medical me-1"></i>${ref.text}</a>` : ""}
                </div>
            </div>

            <div id="patient-view-${uniqueId}" class="d-none" style="border-left: 4px solid #0dcaf0; padding: 12px; background-color: #f0f9ff; border-radius: 4px;">
                <p class="small mb-1"><strong>What is the risk?</strong> <span class="text-muted">${patientBlock.summary}</span></p>
                <p class="small mb-1"><strong>Why?</strong> <span class="text-muted">${patientBlock.why}</span></p>
                <p class="small mb-1"><strong>What to watch for?</strong> <span class="text-muted">${patientBlock.watch}</span></p>
                <div class="p-2 bg-white border rounded mt-2">
                    <p class="small mb-0 text-danger" style="font-size:11.5px;"><strong>Action:</strong> ${patientBlock.action}</p>
                </div>
            </div>
        </div>
    `;
}

function attachCardToggles(root) {
    root.querySelectorAll('.form-check-input[id^="toggle-"]').forEach((toggle) => {
        const suffix = toggle.id.replace("toggle-", "");
        const clinician = document.getElementById(`clinician-view-${suffix}`);
        const patient = document.getElementById(`patient-view-${suffix}`);
        const card = toggle.closest(".rounded.border");

        toggle.addEventListener("change", () => {
            const checked = toggle.checked;
            if (clinician) clinician.classList.toggle("d-none", checked);
            if (patient) patient.classList.toggle("d-none", !checked);
            if (card) card.style.borderLeft = checked ? "4px solid #0dcaf0" : "";
        });
    });
}

function renderDynamicResults(results, classification) {
    const resultArea = document.getElementById("aiResultArea");
    if (!resultArea) return;

    if (!results || results.length === 0) {
        const herbs = (classification?.herbs || []).join(", ") || "none detected";
        const drugs = (classification?.drugs || []).join(", ") || "none detected";
        resultArea.innerHTML = `
            <div class="alert alert-info shadow-sm animate__animated animate__fadeIn">
                <i class="fas fa-info-circle me-2"></i>No interaction found in the clinical database and none predicted through the Knowledge Graph. Please monitor the patient and report any adverse effects. (Extracted herbs: ${herbs}. Extracted drugs: ${drugs})
            </div>`;
        return;
    }

    const header = `
        <h6 class="fw-bold mb-3 text-secondary px-2">
            <i class="fas fa-microscope me-2"></i>ANALYSIS RESULTS (${results.length})
        </h6>`;
    resultArea.innerHTML = header + results.map((result, index) => renderClinicalCard(result, index)).join("");
    attachCardToggles(resultArea);

    const graphPayload = results.map((result) => ({
        herb: result.herb_name,
        drug: result.drug_name,
        severity: result.risk_label,
        "Enzyme Target": result.enzyme_target || "",
        "Mechanism Type": result.mechanism || "",
        source_type: result.source_type || "Dynamic Analysis"
    }));

    if (typeof window.loadGraph === "function" && graphPayload.length > 0) {
        window.loadGraph(graphPayload);
    }
}

function getApiBaseUrl() {
    if (window.NODE_URL) {
        return window.NODE_URL;
    }
    return "http://127.0.0.1:3000";
}

async function requestClinicalAnalysis(noteText) {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: noteText,
            age: parseInt(document.getElementById("patientAge")?.value || "0", 10),
            renal_function: document.getElementById("renalStatus")?.value || "Normal",
            liver_function: document.getElementById("liverStatus")?.value || "Normal"
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Clinical analysis request failed (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const errorText = await response.text();
        throw new Error(`Clinical analysis returned non-JSON response: ${errorText}`);
    }

    const data = await response.json();
    return {
        ...data,
        classification: data.classification || data.entities || { herbs: [], drugs: [] }
    };
}

/* -------------------------------------------------------
   runDeepAI — Clinical Note analysis (canonical version)
   Saves to history ONCE per unique result.
------------------------------------------------------- */
window.runDeepAI = async function() {
    const textInput = document.getElementById("clinicalNoteInput")?.value || "";
    const resultArea = document.getElementById("aiResultArea");

    if (!textInput.trim()) {
        alert("Please enter clinical notes for analysis.");
        return;
    }

    resultArea.innerHTML = `
        <div class="p-4 text-center">
            <div class="spinner-border text-primary mb-2" role="status"></div>
            <p class="fw-bold mb-0">Analyzing clinical note...</p>
            <small class="text-muted">Entity extraction → database match → clinical mapping</small>
        </div>`;

    try {
        const payload = await requestClinicalAnalysis(textInput);
        window.lastClinicalAnalysis = {
            noteText: textInput,
            classification: payload.classification || { herbs: [], drugs: [] },
            results: payload.results || [],
            generatedAt: new Date().toISOString()
        };

        renderDynamicResults(window.lastClinicalAnalysis.results, window.lastClinicalAnalysis.classification);

        // Save to history ONCE per result (no double-logging)
        (window.lastClinicalAnalysis.results || []).forEach((result) => {
            if (typeof window.saveToHistory === "function") {
                window.saveToHistory(
                    result.herb_name || "Unknown Herb",
                    result.drug_name || "Unknown Drug",
                    result.risk_label || "Moderate",
                    result.clinical_effect || result.mechanism || "Clinical interaction identified.",
                    resolveRiskLevel(result)
                );
            }
        });

        if (typeof window.loadDashboard === "function") {
            window.loadDashboard();
        }
    } catch (error) {
        console.error("Dynamic analysis error:", error);
        resultArea.innerHTML = `
            <div class="alert alert-danger shadow-sm">
                <i class="fas fa-exclamation-triangle me-2"></i>Clinical analysis failed. Please verify the backend is running.
            </div>`;
    }
};

/* -------------------------------------------------------
   runManualCheck — Manual herb+drug pair checker
   Reads from manualHerbInput / manualDrugInput (correct IDs).
   Saves to history ONCE per match found.
   Falls back to Predictive KG when no CSV match found.
------------------------------------------------------- */
window.runManualCheck = window.manualInteractionCheck = async function() {
    const herbRaw = (document.getElementById('manualHerbInput')?.value || "").toLowerCase().trim();
    const drugRaw = (document.getElementById('manualDrugInput')?.value || "").toLowerCase().trim();
    const resultArea = document.getElementById('manualCheckResults');

    if (!herbRaw || !drugRaw) {
        if (resultArea) resultArea.innerHTML = `<div class="alert alert-secondary small">Please enter both a herb and drug name.</div>`;
        return;
    }

    if (resultArea) resultArea.innerHTML = `<div class="spinner-border spinner-border-sm text-primary"></div> Scanning Clinical Database...`;

    const normalizeSearch = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const herbSearch = normalizeSearch(herbRaw);
    const drugSearch = normalizeSearch(drugRaw);

    try {
        const baseUrl = getApiBaseUrl();
        const listResponse = await fetch(`${baseUrl}/api/list-all`);
        if (!listResponse.ok) {
            const errorText = await listResponse.text();
            throw new Error(`List-all request failed (${listResponse.status}): ${errorText}`);
        }
        const listContentType = listResponse.headers.get("content-type") || "";
        if (!listContentType.includes("application/json")) {
            const errorText = await listResponse.text();
            throw new Error(`List-all returned non-JSON response: ${errorText}`);
        }
        const listJson = await listResponse.json();
        const listData = Array.isArray(listJson) ? listJson : listJson.data || [];
        const matches = listData.filter((item) => {
            const herbText = normalizeSearch(item['Herb Name'] || item.herb_name || item.herb || item['herb name'] || item.herb_low || item.herb);
            const drugText = normalizeSearch(item['Drug Name'] || item.drug_name || item.drug || item['drug name'] || item.drug_low || item.drug);
            const herbMatch = fuzzyMatchTerms(herbSearch, herbText);
            const drugMatch = fuzzyMatchTerms(drugSearch, drugText);
            return herbMatch && drugMatch;
        });

        if (matches.length > 0) {
            if (resultArea) resultArea.innerHTML = "";
            const seenKeys = new Set();
            matches.forEach((item) => {
                const herbName = item['Herb Name'] || item.herb_name || item.herb || "Unknown Herb";
                const drugName = item['Drug Name'] || item.drug_name || item.drug || "Unknown Drug";
                const key = `${normalizeSearch(herbName)}-${normalizeSearch(drugName)}`;
                if (seenKeys.has(key)) return;
                seenKeys.add(key);

                const result = {
                    herb_name: herbName,
                    drug_name: drugName,
                    scientific_name: item['Scientific Name'] || item.scientific_name || "",
                    drug_class: item['Drug Class'] || item.drug_class || item['drug class'] || "",
                    mechanism: item['Mechanism Type'] || item.mechanism || item['mechanism'] || "Herb-drug interaction via shared metabolic pathway.",
                    clinical_effect: item['Clinical Effect'] || item.effect || item['effect'] || "Interaction identified based on the herb-drug combination.",
                    risk_label: item['Severity'] || item.severity || "Moderate",
                    enzyme_target: item['Enzyme Target'] || item.enzyme || item['enzyme target'] || "",
                    source_type: "HDI Master List"
                };

                const cardHtml = renderClinicalCard(result, Math.random());
                const wrap = document.createElement('div');
                wrap.innerHTML = cardHtml;
                if (resultArea) resultArea.appendChild(wrap);
                attachCardToggles(wrap);

                if (typeof window.saveToHistory === "function") {
                    window.saveToHistory({
                        herb: result.herb_name,
                        drug: result.drug_name,
                        severity: result.risk_label,
                        mechanism: result.mechanism,
                        clinicalEffect: result.clinical_effect,
                        recommendation: result.recommendation || "",
                        monitoring: result.monitoring || "",
                        patientSummary: result.patient_summary || result.patientSummary || "",
                        sourceType: result.source_type || "HDI Master List",
                        reference: result.reference || "",
                        riskLevel: resolveRiskLevel(result),
                        risk_label: result.risk_label,
                        timestamp: new Date().toISOString()
                    });
                }
            });
            return;
        }

        // Use the analysis engine endpoint (handles CSV + Predictive KG fallback)
        const sentence = `Patient is taking ${herbRaw} with ${drugRaw}.`;

        const payload = await requestClinicalAnalysis(sentence);

        if (!payload.results || payload.results.length === 0) {
            // No result from server — show informative message
            const herbs = (payload.classification?.herbs || []).join(", ") || herbRaw;
            const drugs = (payload.classification?.drugs || []).join(", ") || drugRaw;
            if (resultArea) resultArea.innerHTML = `
                <div class="alert alert-secondary small">
                    <i class="fas fa-info-circle me-1"></i>
                    No interaction found in the CSV database.<br>
                    <span class="text-muted" style="font-size:10px;">Extracted: Herbs — ${herbs} | Drugs — ${drugs}</span><br>
                    <span class="text-muted" style="font-size:10px;">No predictive KG overlap found for this pair. Monitor clinically.</span>
                </div>`;
            return;
        }

        // Render results
        if (resultArea) resultArea.innerHTML = "";
        const seenKeys = new Set();
        payload.results.forEach((result) => {
            const key = `${(result.herb_name||"").toLowerCase()}-${(result.drug_name||"").toLowerCase()}`;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            const cardHtml = renderClinicalCard(result, Math.random());
            const wrap = document.createElement('div');
            wrap.innerHTML = cardHtml;
            if (resultArea) resultArea.appendChild(wrap);
            attachCardToggles(wrap);

            // Save to history ONCE per unique result
            if (typeof window.saveToHistory === "function") {
                window.saveToHistory({
                    herb: result.herb_name || herbRaw,
                    drug: result.drug_name || drugRaw,
                    severity: result.risk_label || "Moderate",
                    mechanism: result.mechanism || "",
                    clinicalEffect: result.clinical_effect || "Interaction identified.",
                    recommendation: result.recommendation || "",
                    monitoring: result.monitoring || "",
                    patientSummary: result.patient_summary || result.patientSummary || "",
                    sourceType: result.source_type || "Manual Check",
                    reference: result.reference || "",
                    riskLevel: resolveRiskLevel(result),
                    risk_label: result.risk_label || "Moderate",
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Update knowledge graph
        const graphPayload = payload.results.map(r => ({
            herb: r.herb_name,
            drug: r.drug_name,
            severity: r.risk_label,
            "Enzyme Target": r.enzyme_target || "",
            "Mechanism Type": r.mechanism || "",
            source_type: r.source_type || "Manual Check"
        }));
        if (typeof window.loadGraph === "function" && graphPayload.length > 0) {
            window.loadGraph(graphPayload);
        }

    } catch (error) {
        console.error("Manual check error:", error);
        if (resultArea) resultArea.innerHTML = `<div class="alert alert-danger small"><i class="fas fa-exclamation-triangle me-1"></i>System link error. Ensure node server.js is running.</div>`;
    }
};

window.updateGeriatricAgeBadge = function() {
    const age = parseInt(document.getElementById("patientAge")?.value || "0", 10);
    const badge = document.getElementById("ageRiskBadge");
    if (!badge) return;
    if (age >= 60) {
        badge.style.display = "inline-flex";
        badge.textContent = "Geriatric Risk";
    } else {
        badge.style.display = "none";
    }
};

window.exportClinicalReport = function() {
    const analysis = window.lastClinicalAnalysis;
    if (!analysis || !analysis.results || analysis.results.length === 0) {
        alert("No clinical data to export. Please run a scan first.");
        return;
    }

    const patientName = document.getElementById("patientNameInput")?.value || "Patient_Record";
    const patientAge = document.getElementById("patientAge")?.value || "0";
    const renalStatus = document.getElementById("renalStatus")?.value || "Normal";
    const liverStatus = document.getElementById("liverStatus")?.value || "Normal";
    const exportPayload = {
        patientName,
        patientAge,
        renalStatus,
        liverStatus,
        noteText: analysis.noteText,
        results: analysis.results.map((result) => ({
            ...result,
            risk_level: resolveRiskLevel(result)
        }))
    };

    fetch("http://127.0.0.1:3000/api/export-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportPayload)
    })
        .then((response) => {
            if (!response.ok) throw new Error("PDF export failed.");
            return response.blob();
        })
        .then((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Clinical_Report_${patientName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Log the PDF export event
            window.logGeneratedReport(patientName, analysis.results.length, exportPayload.results);
        })
        .catch((error) => {
            console.error("PDF export error:", error);
            alert("PDF export failed. Please try again.");
        });
};

window.logGeneratedReport = function(patientName, resultCount, resultsPayload = []) {
    let reports = JSON.parse(localStorage.getItem('generated_reports')) || [];
    reports.unshift({
        id: 'REP-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        patient: patientName,
        count: resultCount,
        timestamp: new Date().toLocaleString(),
        fileName: `Clinical_Report_${patientName}.pdf`,
        resultsPayload: resultsPayload
    });
    if (reports.length > 5) reports = reports.slice(0, 5);
    localStorage.setItem('generated_reports', JSON.stringify(reports));
    // Refresh the report log to show latest
    if (typeof window.renderReportLog === "function") window.renderReportLog();
};

document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.renderHistory === "function") window.renderHistory();
    if (typeof window.renderReportLog === "function") window.renderReportLog();
    if (typeof window.updateGeriatricAgeBadge === "function") window.updateGeriatricAgeBadge();
    const ageField = document.getElementById("patientAge");
    if (ageField) {
        ageField.addEventListener("input", () => {
            if (typeof window.updateGeriatricAgeBadge === "function") window.updateGeriatricAgeBadge();
        });
    }
});
