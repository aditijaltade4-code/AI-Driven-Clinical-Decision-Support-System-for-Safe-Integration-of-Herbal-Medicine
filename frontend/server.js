const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cors = require("cors");
const { createAnalysisEngine } = require("./analysisEngine");
const { generateClinicalReportPdf } = require("./pdfReport");

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const CSV_PATH = path.join(__dirname, "data", "HDI_Master_List.csv");
const MAPPING_PATH = path.join(__dirname, "entity_mapping.json");
const DRUG_SOURCE_PATH = path.join(__dirname, "Drug_Source_Master.csv");
const PREDICTIVE_KG_PATH = path.join(__dirname, "Predictive_kg.csv");

let interactionsDB = [];
let drugAliasesDB = [];
let predictiveKgDB = [];
let mappingData = { synonyms: {} };
let analysisEngine = null;
let lastLoadedAt = 0;

function loadJsonIfPresent(filePath, fallbackValue) {
    try {
        if (!fs.existsSync(filePath)) return fallbackValue;
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        console.error(`[JSON] Failed to load ${filePath}:`, error.message);
        return fallbackValue;
    }
}

function loadCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        if (!fs.existsSync(filePath)) {
            resolve(rows);
            return;
        }

        fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve(rows))
            .on("error", (error) => reject(error));
    });
}

async function loadData(force = false) {
    const csvExists = fs.existsSync(CSV_PATH);
    const csvMtime = csvExists ? fs.statSync(CSV_PATH).mtimeMs : 0;
    if (!force && analysisEngine && csvMtime === lastLoadedAt) return;

    if (!csvExists) {
        interactionsDB = [];
        analysisEngine = null;
        console.error(`[CSV] Missing file at ${CSV_PATH}`);
        return;
    }

    interactionsDB = await loadCsvFile(CSV_PATH);
    drugAliasesDB = await loadCsvFile(DRUG_SOURCE_PATH);
    predictiveKgDB = await loadCsvFile(PREDICTIVE_KG_PATH);
    mappingData = loadJsonIfPresent(MAPPING_PATH, { synonyms: {} });
    analysisEngine = createAnalysisEngine(interactionsDB, mappingData, drugAliasesDB, predictiveKgDB);
    lastLoadedAt = csvMtime;

    console.log(`[BOOT] Loaded ${interactionsDB.length} interaction rules from ${CSV_PATH}`);
}

function requireEngine(req, res, next) {
    if (!analysisEngine) {
        res.status(503).json({ error: "Clinical analysis engine is not ready." });
        return;
    }
    next();
}

function buildApiRow(row) {
    return {
        herb: row["Herb Name"] || row.herb || "",
        drug: row["Drug Name"] || row.drug || "",
        severity: row["Severity"] || row.severity || "",
        "Herb Name": row["Herb Name"] || row.herb || "",
        "Scientific Name": row["Scientific Name"] || "",
        "Common Name": row["Common Name"] || "",
        "Active Ingredients": row["Active Ingredients"] || "",
        "Drug Name": row["Drug Name"] || row.drug || "",
        "Drug Class": row["Drug Class"] || "",
        "Enzyme Target": row["Enzyme Target"] || "",
        "Mechanism Type": row["Mechanism Type"] || "",
        "Interaction Type": row["Interaction Type"] || "",
        "Clinical Effect": row["Clinical Effect"] || "",
        "Severity": row["Severity"] || row.severity || "",
        "Evidence Level": row["Evidence Level"] || "",
        "Reference": row["Reference"] || "",
        "Clinical Recommendation": row["Clinical Recommendation"] || ""
    };
}

app.get("/api/health", async (req, res) => {
    await loadData();
    res.json({
        status: analysisEngine ? "ready" : "degraded",
        records: interactionsDB.length,
        csvPath: CSV_PATH
    });
});

app.get("/api/mapping", async (req, res) => {
    await loadData();
    res.json(mappingData);
});

app.get("/api/config", (req, res) => {
    res.json({
        status: "active",
        engine: "Clinical Node Gateway",
        mode: "dynamic-analysis"
    });
});

app.get("/api/list-all", async (req, res) => {
    await loadData();
    res.json({
        data: interactionsDB.map(buildApiRow),
        meta: {
            count: interactionsDB.length,
            csvPath: CSV_PATH,
            csvExists: fs.existsSync(CSV_PATH)
        }
    });
});

app.post("/api/analyze-text", async (req, res) => {
    await loadData();
    if (!analysisEngine) {
        res.status(503).json({ error: "Clinical analysis engine is not available." });
        return;
    }

    const {
        text = "",
        age = 0,
        gender = "Not Specified",
        renal_function = "Normal",
        liver_function = "Normal"
    } = req.body || {};

    if (!String(text).trim()) {
        res.status(400).json({ error: "No clinical note provided." });
        return;
    }

    const context = { age, gender, renal_function, liver_function };
    const analysis = analysisEngine.analyzeText(text, context);

    res.json({
        status: "success",
        results: analysis.results,
        classification: analysis.classification,
        meta: {
            resultCount: analysis.results.length,
            analyzedAt: new Date().toISOString(),
            dynamic: true
        }
    });
});

app.post("/api/export-report", (req, res) => {
    const payload = req.body || {};
    const results = Array.isArray(payload.results) ? payload.results : [];

    if (results.length === 0) {
        res.status(400).json({ error: "No analysis results provided for PDF export." });
        return;
    }

    const pdfBuffer = generateClinicalReportPdf(payload);
    const patientName = String(payload.patientName || "Patient_Record").replace(/[^a-z0-9_-]+/gi, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Clinical_Report_${patientName}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
});

const PORT = process.env.PORT || 3000;
loadData(true)
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Clinical Node Gateway running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error("[BOOT] Failed to start server:", error);
        process.exit(1);
    });
