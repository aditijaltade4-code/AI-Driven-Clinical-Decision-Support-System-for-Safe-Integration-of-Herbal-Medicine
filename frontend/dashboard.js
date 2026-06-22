/* ---------------------------------------------------
    Dashboard Analytics for HerbRx - v6.0 (Fixed)
    Fixes: double-logging, history registration, dashboard sync
---------------------------------------------------*/

(function() {
    const DASHBOARD_CONFIG = { BASE_URL: "http://localhost:3000" };
    let interactionData = [];

    async function loadDashboard() {
        const syncStatus = document.getElementById('dbSyncStatus');

        try {
            const response = await fetch(`${DASHBOARD_CONFIG.BASE_URL}/api/list-all`);
            const jsonResponse = await response.json();
            const dbData = (jsonResponse && Array.isArray(jsonResponse.data)) ? jsonResponse.data : [];

            const formattedDbRecords = (Array.isArray(dbData) ? dbData : []).map(formatEntityRecord);
            const sessionHistory = JSON.parse(localStorage.getItem('hdi_history')) || [];
            const formattedSessionRecords = Array.isArray(sessionHistory) ? sessionHistory.map(formatSessionRecord) : [];

            const analyticsSource = formattedSessionRecords.length > 0 ? 'session' : 'database';
            interactionData = analyticsSource === 'session' ? formattedSessionRecords : formattedDbRecords;

            renderSeverityDistribution();
            renderFrequentInteractors();
            renderIncidenceTrends();
            updateAIInsights(interactionData, analyticsSource);

            if (syncStatus) {
                const totalRecords = interactionData.length;
                const sourceLabel = analyticsSource === 'session' ? 'Session analytics active' : 'Database analytics active';
                syncStatus.innerText = `${sourceLabel}: ${totalRecords} interactions analyzed`;
                syncStatus.className = totalRecords > 0 ? 'badge bg-success' : 'badge bg-warning';
            }

        } catch (error) {
            console.error('Dashboard Load Error:', error);
            const sessionHistory = JSON.parse(localStorage.getItem('hdi_history')) || [];
            interactionData = Array.isArray(sessionHistory) ? sessionHistory.map(formatSessionRecord) : [];
            renderSeverityDistribution();
            renderFrequentInteractors();
            renderIncidenceTrends();
            updateAIInsights(interactionData, 'session');
            if (syncStatus) syncStatus.innerText = 'OFFLINE MODE: SESSION DATA ONLY';
        }

        window.dispatchEvent(new Event('chartsRendered'));
    }

    function formatEntityRecord(item) {
        return {
            herb: String(item.herb || item.herb_name || item.Herb || item.HerbName || '').trim(),
            drug: String(item.drug || item.drug_name || item.Drug || item.DrugName || '').trim(),
            severity: String(item.severity || item.severity_text || item.risk_label || '').trim() || 'Unknown',
            risk_level: parseRiskValue(item),
            riskScore: parseRiskValue(item),
            mechanism: String(item.mechanism || item.clinical_effect || item.effect || '').trim(),
            timestamp: item.timestamp || item.created_at || new Date().toISOString()
        };
    }

    function formatSessionRecord(item) {
        return {
            herb: String(item.herb || item.herb_name || '').trim(),
            drug: String(item.drug || item.drug_name || '').trim(),
            severity: String(item.severity || item.severity_text || item.risk_label || 'Unknown').trim(),
            risk_level: parseRiskValue(item),
            riskScore: parseRiskValue(item),
            mechanism: String(item.mechanism || item.summary || item.effect || '').trim(),
            timestamp: item.timestamp || new Date().toISOString()
        };
    }

    function parseRiskValue(item) {
        const raw = item.risk_level ?? item.riskLevel ?? item.riskScore ?? item.risk_score ?? item.score ?? 0;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function getSeverityBucket(item) {
        const text = String(item.severity || '').toLowerCase();
        const level = Number(item.risk_level || item.riskScore || 0);
        if (level >= 4 || /critical|major|high|severe/.test(text)) return 'Major';
        if (level === 3 || /moderate|warn|medium/.test(text)) return 'Moderate';
        if (level > 0 || /minor|low|mild/.test(text)) return 'Minor';
        return 'Unknown';
    }

    /* --- 1. SEVERITY PIE CHART (First) --- */
    function renderSeverityDistribution() {
        const counts = { Major: 0, Moderate: 0, Minor: 0, Unknown: 0 };
        interactionData.forEach(item => {
            const bucket = getSeverityBucket(item);
            counts[bucket] = (counts[bucket] || 0) + 1;
        });

        createChart('severityPieChart', 'pie', {
            labels: ['Major', 'Moderate', 'Minor', 'Unknown'],
            datasets: [{
                data: [counts.Major, counts.Moderate, counts.Minor, counts.Unknown],
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#6b7280'],
                borderWidth: 0
            }]
        }, 'Risk Distribution');
    }

    /* --- 2. TOP FLAGGED DRUGS (Second) --- */
    function renderFrequentInteractors() {
        let drugCounts = {};
        interactionData.forEach(item => {
            let name = (item.drug || item.drug_name || item.drug_low || "Not specified").toLowerCase().trim();
            if (name === "omeprazole" || name === "omez") name = "pantoprazole";
            let formatted = name.charAt(0).toUpperCase() + name.slice(1);
            drugCounts[formatted] = (drugCounts[formatted] || 0) + 1;
        });

        const sorted = Object.entries(drugCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        createChart("frequencyBarChart", "bar", {
            labels: sorted.map(d => d[0]),
            datasets: [{
                label: "Hits",
                data: sorted.map(d => d[1]),
                backgroundColor: "#3b82f6",
                borderRadius: 4
            }]
        }, "Top Flagged Drugs");
    }

    /* --- 3. INCIDENCE TREND (Third — at bottom) --- */
    function renderIncidenceTrends() {
        const dailyCounts = {};
        const last5Days = [];

        for (let i = 4; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const label = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
            last5Days.push(label);
            dailyCounts[label] = { critical: 0, moderate: 0 };
        }

        interactionData.forEach(item => {
            const itemDate = new Date(item.timestamp || item.created_at);
            if (Number.isNaN(itemDate.getTime())) return;
            const itemLabel = itemDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });

            if (dailyCounts[itemLabel]) {
                const sev = (item.severity || "").toLowerCase();
                const riskLevel = Number(item.risk_level || item.riskLevel || 0);
                if (riskLevel >= 4 || sev.match(/high|severe|major|critical/)) {
                    dailyCounts[itemLabel].critical++;
                } else if (riskLevel === 3 || sev.match(/moderate|warn|medium/)) {
                    dailyCounts[itemLabel].moderate++;
                }
            }
        });

        const data = {
            labels: last5Days,
            datasets: [
                {
                    label: 'Critical',
                    data: last5Days.map(day => dailyCounts[day].critical),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Moderate',
                    data: last5Days.map(day => dailyCounts[day].moderate),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };

        createChart("timeSeriesChart", "line", data, "Interaction Incidence Trends");
    }

    /* --- 4. CLINICAL INSIGHTS --- */
    function updateAIInsights(data, analyticsSource) {
        const panel = document.getElementById('aiInsightList');
        if (!panel || !Array.isArray(data)) return;

        const total = data.length;
        const majorCount = data.filter(i => getSeverityBucket(i) === 'Major').length;
        const moderateCount = data.filter(i => getSeverityBucket(i) === 'Moderate').length;
        const minorCount = data.filter(i => getSeverityBucket(i) === 'Minor').length;
        const unknownCount = data.filter(i => getSeverityBucket(i) === 'Unknown').length;
        const highRiskCount = data.filter(i => getSeverityBucket(i) === 'Major').length;
        const highRiskPct = total > 0 ? Math.round((highRiskCount / total) * 100) : 0;
        const moderatePct = total > 0 ? Math.round((moderateCount / total) * 100) : 0;

        const drugCounts = {};
        const herbCounts = {};
        data.forEach(item => {
            const drug = String(item.drug || item.drug_name || '').trim();
            const herb = String(item.herb || item.herb_name || '').trim();
            if (drug) drugCounts[drug] = (drugCounts[drug] || 0) + 1;
            if (herb) herbCounts[herb] = (herbCounts[herb] || 0) + 1;
        });

        const topDrugEntry = Object.entries(drugCounts).sort((a, b) => b[1] - a[1])[0];
        const topHerbEntry = Object.entries(herbCounts).sort((a, b) => b[1] - a[1])[0];
        const topDrugLabel = topDrugEntry ? `${topDrugEntry[0]} (${topDrugEntry[1]} interactions)` : 'No drug trends available';
        const topHerbLabel = topHerbEntry ? `${topHerbEntry[0]} (${topHerbEntry[1]} interactions)` : 'No herb trends available';

        let systemIntel = '';
        if (analyticsSource === 'session') {
            if (majorCount > 0) {
                systemIntel = `${topDrugEntry ? topDrugEntry[0] : 'A drug'} is the most frequently searched high-risk drug in this session. ${majorCount} major interactions and ${moderateCount} moderate interactions were identified in current session activity. ${topHerbEntry ? topHerbEntry[0] : 'A herb'} is the most frequently analyzed herb during this session.`;
            } else if (moderateCount > 0) {
                systemIntel = `${topDrugEntry ? topDrugEntry[0] : 'A drug'} is the most frequently searched moderate-risk drug in this session. ${moderateCount} moderate interactions are currently tracked, and ${topHerbEntry ? topHerbEntry[0] : 'a herb'} is the session's most common herb.`;
            } else {
                systemIntel = `Session analytics are active. ${total} interactions have been tracked in this session with ${highRiskCount} high-risk signals.`;
            }
        } else {
            if (topDrugEntry && topHerbEntry) {
                systemIntel = `${topDrugEntry[0]} is the most frequently flagged drug in the interaction database. Moderate-risk interactions account for ${moderatePct}% of recorded interactions. ${topHerbEntry[0]} is among the most frequently reported herbs in database records.`;
            } else {
                systemIntel = `Database analytics are active with ${total} recorded interaction records.`;
            }
        }

        panel.innerHTML = `
            <div class="d-flex flex-row flex-wrap gap-3">
                <div class="insight-card animate__animated animate__fadeInRight">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-exclamation-triangle text-danger me-2"></i>
                        <strong class="text-uppercase small text-dark fw-bold">Risk Snapshot</strong>
                    </div>
                    <p class="small text-muted mb-0 lh-base">${highRiskPct}% high-risk interactions identified. ${moderatePct}% moderate-risk interactions identified. ${total} total interactions analyzed.</p>
                </div>
                <div class="insight-card animate__animated animate__fadeInRight" style="animation-delay: 0.1s;">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-chart-line text-primary me-2"></i>
                        <strong class="text-uppercase small text-dark fw-bold">Top Flagged Drug</strong>
                    </div>
                    <p class="small text-muted mb-0 lh-base">${topDrugLabel}</p>
                </div>
                <div class="insight-card animate__animated animate__fadeInRight" style="animation-delay: 0.2s;">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-leaf text-success me-2"></i>
                        <strong class="text-uppercase small text-dark fw-bold">Top Flagged Herb</strong>
                    </div>
                    <p class="small text-muted mb-0 lh-base">${topHerbLabel}</p>
                </div>
                <div class="insight-card animate__animated animate__fadeInRight" style="animation-delay: 0.3s;">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-robot text-info me-2"></i>
                        <strong class="text-uppercase small text-dark fw-bold">System Intelligence</strong>
                    </div>
                    <p class="small text-muted mb-0 lh-base">${systemIntel}</p>
                </div>
            </div>
        `;
    }

    /* --- HELPER: UNIVERSAL CHART ENGINE --- */
    function createChart(id, type, data, title) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const existing = Chart.getChart(id);
        if (existing) existing.destroy();

        return new Chart(canvas.getContext('2d'), {
            type: type,
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: title, font: { size: 10 }, padding: 4 },
                    legend: { display: (type === 'pie'), position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } }
                },
                scales: (type === 'bar' || type === 'line') ? {
                    y: { beginAtZero: true, ticks: { font: { size: 8 } }, grid: { display: false } },
                    x: { ticks: { font: { size: 8 } }, grid: { display: false } }
                } : {}
            }
        });
    }

    document.addEventListener('DOMContentLoaded', loadDashboard);
    // EXPOSE TO GLOBAL SCOPE
    window.loadDashboard = loadDashboard;
    window.refreshDashboard = loadDashboard;
})();

window._dashboardRefreshTimer = null;

/* =====================================================
   HISTORY MANAGEMENT — SINGLE SOURCE OF TRUTH
   Defined ONCE here. app.js duplicates are removed.
   overrides.js version is also superseded here.
======================================================*/

/**
 * saveToHistory — deduplicated, single write per unique herb+drug pair.
 * Called after any scan (manual or deep AI).
 */
window.saveToHistory = function(entryOrHerb, drug, severity, mechanism, riskLevel) {
    const entry = typeof entryOrHerb === 'object' && entryOrHerb !== null
        ? entryOrHerb
        : {
            herb: entryOrHerb,
            drug: drug,
            severity: severity,
            mechanism: mechanism,
            riskScore: riskLevel,
            risk_level: riskLevel
        };

    let history = JSON.parse(localStorage.getItem('hdi_history')) || [];

    const normalizedHerb = String(entry.herb || '').trim();
    const normalizedDrug = String(entry.drug || '').trim();
    const normalizedSeverity = String(entry.severity || 'Moderate').trim();
    const normalizedMechanism = String(entry.mechanism || entry.clinicalEffect || entry.clinical_effect || '').trim();
    const normalizedRisk = Number.isFinite(Number(entry.riskScore ?? entry.risk_level ?? entry.riskLevel ?? entry.score))
        ? Number(entry.riskScore ?? entry.risk_level ?? entry.riskLevel ?? entry.score)
        : null;

    history = history.filter(item => {
        const itemHerb = String(item.herb || '').trim();
        const itemDrug = String(item.drug || '').trim();
        return !(itemHerb.toUpperCase() === normalizedHerb.toUpperCase() && itemDrug.toUpperCase() === normalizedDrug.toUpperCase());
    });

    const reportId = entry.id || `REP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const reportTimestamp = entry.timestamp || new Date().toISOString();
    const reportSummary = String(entry.summary || normalizedMechanism || entry.clinicalEffect || entry.clinical_effect || '').trim();

    history.unshift({
        id: reportId,
        timestamp: reportTimestamp,
        displayTime: new Date(reportTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        herb: normalizedHerb,
        drug: normalizedDrug,
        severity: normalizedSeverity,
        riskScore: normalizedRisk,
        risk_level: normalizedRisk,
        risk_label: String(entry.risk_label || entry.severity || '').trim(),
        mechanism: normalizedMechanism,
        clinicalEffect: String(entry.clinicalEffect || entry.clinical_effect || entry.effect || '').trim(),
        monitoring: String(entry.monitoring || entry.monitoringRecommendations || '').trim(),
        recommendation: String(entry.recommendation || entry.clinical_recommendation || '').trim(),
        patientSummary: String(entry.patientSummary || entry.patient_summary || entry.patientMode || '').trim(),
        sourceType: String(entry.sourceType || entry.source_type || '').trim(),
        reference: String(entry.reference || '').trim(),
        summary: reportSummary ? `${reportSummary.substring(0, 80)}...` : '',
    });

    if (history.length > 10) history = history.slice(0, 10);
    localStorage.setItem('hdi_history', JSON.stringify(history));

    if (typeof window.renderHistory === 'function') window.renderHistory();
    if (typeof window.renderReportLog === 'function') window.renderReportLog();

    if (typeof window.loadDashboard === 'function') {
        if (window._dashboardRefreshTimer) clearTimeout(window._dashboardRefreshTimer);
        window._dashboardRefreshTimer = setTimeout(() => {
            window._dashboardRefreshTimer = null;
            window.loadDashboard();
        }, 100);
    }
};

/**
 * renderHistory — populates the sidebar scan history list (historyList element)
 */
window.renderHistory = function() {
    const list = document.getElementById('historyList');
    const data = JSON.parse(localStorage.getItem('hdi_history')) || [];
    if (!list) return;

    list.innerHTML = data.length ? data.map(item => {
        const riskLevel = Number(item.risk_level || 0);
        const sev = (item.severity || "").toUpperCase();
        const badge = (riskLevel >= 5 || sev.includes("CRITICAL") || sev.includes("MAJOR") || sev.includes("HIGH"))
            ? "bg-danger"
            : (riskLevel >= 3 || sev.includes("MODERATE"))
                ? "bg-warning text-dark"
                : "bg-info text-dark";

        return `
            <div class="p-2 border-bottom x-small animate__animated animate__fadeIn">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold" style="font-size: 11px; color: #1e293b;">
                        ${(item.herb || "").toUpperCase()} + ${(item.drug || "").toUpperCase()}
                    </span>
                    <span class="text-muted" style="font-size: 9px;">${item.displayTime || ""}</span>
                </div>
                <div class="badge ${badge}" style="font-size: 8px; font-weight: 700;">
                    ${riskLevel ? `RISK ${riskLevel}/5` : sev}
                </div>
            </div>`;
    }).join('') : '<p class="text-center text-muted x-small mt-3">No scans yet.</p>';
};

/**
 * renderReportLog — populates the Report Logs page (generatedReportsList element)
 * Shows all scanned interactions as cards with severity badges.
 */
window.renderReportLog = function() {
    const container = document.getElementById('generatedReportsList');
    let data = JSON.parse(localStorage.getItem('hdi_history')) || [];

    if (!container) return;

    let updated = false;
    data = data.map((item) => {
        if (!item.id) {
            updated = true;
            return { ...item, id: `REP-${Math.random().toString(36).substr(2, 9).toUpperCase()}` };
        }
        return item;
    });

    if (updated) {
        localStorage.setItem('hdi_history', JSON.stringify(data));
    }

    if (data.length === 0) {
        container.innerHTML = `
            <div class="p-5 text-center text-muted border rounded bg-light">
                <i class="fas fa-file-invoice fa-3x mb-3 opacity-25"></i>
                <p>No interactions scanned in this session.</p>
                <small>Run a Deep Analysis or Manual Check to populate this log.</small>
            </div>`;
        return;
    }

    container.innerHTML = data.map((entry, idx) => {
        const sev = (entry.severity || "").toUpperCase();
        const badgeClass = sev.match(/CRITICAL|MAJOR|HIGH|SEVERE/) ? 'bg-danger' :
                           sev.match(/MODERATE/) ? 'bg-warning text-dark' :
                           sev.match(/LOW|MINOR|MILD/) ? 'bg-info text-dark' : 'bg-success';
        const isGeriatric = sev.includes('GERIATRIC');
        const geriatricBadge = isGeriatric
            ? `<span class="badge bg-warning text-dark ms-1" style="font-size: 8px;"><i class="fas fa-user-clock me-1"></i>GERIATRIC RISK</span>`
            : '';

        return `
            <div class="clinical-card mb-2 p-3 d-flex justify-content-between align-items-center animate__animated animate__fadeIn">
                <div class="flex-grow-1">
                    <h6 class="fw-bold mb-1 text-primary">${entry.herb || "Unknown Herb"} + ${entry.drug || "Unknown Drug"}</h6>
                    <div class="d-flex align-items-center gap-2 flex-wrap">
                        <span class="badge ${badgeClass}" style="font-size: 9px;">${sev}</span>
                        ${geriatricBadge}
                        <span class="x-small text-muted"><i class="fas fa-clock me-1"></i>${entry.timestamp ? entry.timestamp.substring(0, 10) : ''} ${entry.displayTime || ''}</span>
                    </div>
                    <p class="small mb-0 mt-2 text-muted">${entry.summary || ""}</p>
                </div>
                <div class="d-flex flex-column gap-2 ms-3">
                    <button class="btn btn-sm btn-outline-info" onclick="window.exportSingleReportPDF('${entry.id}')">
                        <i class="fas fa-file-pdf"></i> Export PDF
                    </button>
                </div>
            </div>`;
    }).join('');
};

/**
 * Export a single report entry as PDF
 */
window.exportSingleReportPDF = function(reportId) {
    const historyData = JSON.parse(localStorage.getItem('hdi_history')) || [];
    const entry = historyData.find((item) => item.id === reportId);
    if (!entry) {
        console.error('PDF export failed: report not found', reportId, historyData);
        alert('Unable to export this report. The selected interaction record could not be found.');
        return;
    }

    if (!entry.herb || !entry.drug || !entry.severity) {
        console.error('PDF export failed: report data missing', reportId, entry);
        alert('Cannot export this report because required report fields are missing.');
        return;
    }

    const patientSummary = entry.patientSummary || entry.patient_summary || 'N/A';
    const clinicalEffect = entry.clinicalEffect || entry.clinical_effect || entry.summary || 'N/A';
    const monitoring = entry.monitoring || 'N/A';
    const recommendation = entry.recommendation || entry.clinical_recommendation || 'N/A';
    const riskScore = entry.riskScore ?? entry.risk_level ?? 'N/A';
    const reportTimestamp = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A';
    const reportFilename = `Interaction_Report_${entry.id}_${entry.herb}_${entry.drug}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    const content = `
        <div style="padding: 40px; font-family: Arial, Helvetica, sans-serif; background: white; color: #111; width: 800px;">
            <h1 style="margin-bottom: 8px; color: #0d6efd;">Clinical Interaction Report</h1>
            <p style="margin: 0 0 24px; color: #334155;">Report ID: <strong>${entry.id}</strong><br>
            Generated: <strong>${reportTimestamp}</strong></p>
            <div style="margin-bottom: 20px; padding: 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc;">
                <h2 style="font-size: 16px; margin-bottom: 10px; color: #0f172a;">Interaction Details</h2>
                <p style="margin: 2px 0;"><strong>Herb:</strong> ${entry.herb}</p>
                <p style="margin: 2px 0;"><strong>Drug:</strong> ${entry.drug}</p>
                <p style="margin: 2px 0;"><strong>Severity:</strong> ${entry.severity}</p>
                <p style="margin: 2px 0;"><strong>Risk Score:</strong> ${riskScore}/5</p>
                <p style="margin: 2px 0;"><strong>Source:</strong> ${entry.sourceType || 'Session History'}</p>
            </div>
            <div style="margin-bottom: 20px; padding: 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #ffffff;">
                <h2 style="font-size: 16px; margin-bottom: 10px; color: #0f172a;">Clinical Findings</h2>
                <p style="margin: 2px 0;"><strong>Mechanism:</strong><br>${entry.mechanism || 'N/A'}</p>
                <p style="margin: 2px 0;"><strong>Clinical Effect:</strong><br>${clinicalEffect}</p>
                <p style="margin: 2px 0;"><strong>Monitoring:</strong><br>${monitoring}</p>
                <p style="margin: 2px 0;"><strong>Recommendation:</strong><br>${recommendation}</p>
                <p style="margin: 2px 0;"><strong>Patient Summary:</strong><br>${patientSummary}</p>
                ${entry.reference ? `<p style="margin: 2px 0;"><strong>Reference:</strong><br>${entry.reference}</p>` : ''}
            </div>
        </div>`;

    const opt = {
        margin: 0.5,
        filename: `${reportFilename}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    const printEl = document.createElement('div');
    printEl.style.position = 'absolute';
    printEl.style.top = '0';
    printEl.style.left = '-9999px';
    printEl.style.width = '800px';
    printEl.style.background = 'white';
    printEl.style.color = '#111';
    printEl.innerHTML = content;
    document.body.appendChild(printEl);

    console.log('Generating PDF for report', reportId, entry);

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(printEl).save().then(() => {
            document.body.removeChild(printEl);
        }).catch((error) => {
            document.body.removeChild(printEl);
            console.error('PDF export failed during generation', reportId, error);
            alert('PDF export failed during generation. Please try again.');
        });
    } else {
        document.body.removeChild(printEl);
        console.error('PDF export failed: html2pdf library not loaded', reportId);
        alert('PDF export failed because the PDF library is unavailable.');
    }
};

/**
 * Report Interaction modal (Formspree)
 */
window.reportNewInteractionFeature = function() {
    const modalHtml = `
        <div id="formspreeModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5); z-index: 9999;">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header bg-light">
                        <h5 class="modal-title fw-bold text-dark"><i class="fas fa-flag text-primary me-2"></i>Report Interaction</h5>
                        <button type="button" class="btn-close" onclick="document.getElementById('formspreeModal').remove()"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form action="https://formspree.io/f/mbdqlnbv" method="POST" onsubmit="setTimeout(() => document.getElementById('formspreeModal').remove(), 1000)">
                            <input type="hidden" name="_subject" value="Herb-Drug Interaction Report">
                            <input type="hidden" name="_language" value="en">
                            <div class="row g-3 mb-3">
                                <div class="col-6">
                                    <label class="form-label x-small fw-bold text-muted text-uppercase">Herb</label>
                                    <input type="text" name="herb" class="form-control" placeholder="e.g. St. John's Wort" required>
                                </div>
                                <div class="col-6">
                                    <label class="form-label x-small fw-bold text-muted text-uppercase">Drug</label>
                                    <input type="text" name="drug" class="form-control" placeholder="e.g. Warfarin" required>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label x-small fw-bold text-muted text-uppercase">Severity</label>
                                <select name="severity" class="form-select" required>
                                    <option value="" disabled selected>Select Severity Level...</option>
                                    <option value="Minor">Minor / Mild</option>
                                    <option value="Moderate">Moderate</option>
                                    <option value="Major">Major / Critical</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label x-small fw-bold text-muted text-uppercase">Clinical Comment</label>
                                <textarea name="comments" class="form-control" rows="3" placeholder="Describe the observed interaction or evidence..." required></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary w-100 fw-bold"><i class="fas fa-paper-plane me-2"></i>Submit Report</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/* Initial load on DOMContentLoaded */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.renderHistory === "function") window.renderHistory();
    if (typeof window.renderReportLog === "function") window.renderReportLog();
});