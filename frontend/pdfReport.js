const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

function escapePdfText(value) {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/[^\x20-\x7E]/g, " ");
}

function wrapText(text, maxChars = 88) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];

    const lines = [];
    let current = words[0];

    for (let i = 1; i < words.length; i += 1) {
        const candidate = `${current} ${words[i]}`;
        if (candidate.length > maxChars) {
            lines.push(current);
            current = words[i];
        } else {
            current = candidate;
        }
    }

    lines.push(current);
    return lines;
}

function rgb(r, g, b) {
    return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
}

function makeSummary(payload) {
    const results = payload.results || [];
    const highestRisk = results.reduce((max, result) => Math.max(max, Number(result.risk_level || 0)), 0);
    const verifiedCount = results.filter((result) => String(result.source_type || "").toLowerCase().includes("verified")).length;
    const inferredCount = results.length - verifiedCount;

    return {
        totalInteractions: results.length,
        highestRisk,
        verifiedCount,
        inferredCount
    };
}

function riskPalette(level) {
    if (level >= 5) {
        return { fill: [185, 28, 28], soft: [254, 226, 226], text: [255, 255, 255], border: [153, 27, 27], label: "Critical" };
    }
    if (level === 4) {
        return { fill: [217, 119, 6], soft: [255, 237, 213], text: [255, 255, 255], border: [180, 83, 9], label: "High" };
    }
    if (level === 3) {
        return { fill: [37, 99, 235], soft: [219, 234, 254], text: [255, 255, 255], border: [29, 78, 216], label: "Moderate" };
    }
    if (level === 2) {
        return { fill: [8, 145, 178], soft: [207, 250, 254], text: [255, 255, 255], border: [14, 116, 144], label: "Low" };
    }
    return { fill: [22, 163, 74], soft: [220, 252, 231], text: [255, 255, 255], border: [21, 128, 61], label: "Minimal" };
}

function renderWrappedText(commands, text, x, y, options = {}) {
    const {
        font = "F1",
        size = 11,
        color = [15, 23, 42],
        maxChars = 88,
        lineGap = 4
    } = options;

    const lines = wrapText(text, maxChars);
    lines.forEach((line, index) => {
        const lineY = y - (index * (size + lineGap));
        commands.push("BT");
        commands.push(`/${font} ${size} Tf`);
        commands.push(`${rgb(color[0], color[1], color[2])} rg`);
        commands.push(`1 0 0 1 ${x} ${lineY} Tm`);
        commands.push(`(${escapePdfText(line)}) Tj`);
        commands.push("ET");
    });

    return lines.length * (size + lineGap);
}

function drawRect(commands, x, y, width, height, options = {}) {
    const { fill = null, stroke = null, lineWidth = 1 } = options;
    if (fill) commands.push(`${rgb(fill[0], fill[1], fill[2])} rg`);
    if (stroke) commands.push(`${rgb(stroke[0], stroke[1], stroke[2])} RG`);
    commands.push(`${lineWidth} w`);
    commands.push(`${x} ${y} ${width} ${height} re`);

    if (fill && stroke) commands.push("B");
    else if (fill) commands.push("f");
    else commands.push("S");
}

function estimateResultHeight(result) {
    const lines = [
        `Clinical Effect: ${result.clinical_effect || "N/A"}`,
        `Mechanism: ${result.mechanism || "N/A"}`,
        `Monitoring: ${result.monitoring || "Routine monitoring advised."}`,
        `Recommendation: ${result.clinical_recommendation || result.recommendation || "Consult a healthcare professional."}`,
        result.reference ? `Reference: ${result.reference}` : ""
    ].filter(Boolean);

    let height = 86;
    lines.forEach((line, index) => {
        const maxChars = index === lines.length - 1 ? 76 : 82;
        height += wrapText(line, maxChars).length * 15;
    });
    return height + 16;
}

function renderPage(pageResults, payload, pageIndex, pageCount) {
    const commands = [];
    let cursorY = PAGE_HEIGHT - MARGIN;
    const summary = makeSummary(payload);

    drawRect(commands, 0, PAGE_HEIGHT - 92, PAGE_WIDTH, 92, { fill: [15, 23, 42] });
    renderWrappedText(commands, "Clinical Interaction Report", MARGIN, PAGE_HEIGHT - 42, {
        font: "F2",
        size: 23,
        color: [255, 255, 255],
        maxChars: 40,
        lineGap: 2
    });
    renderWrappedText(commands, "Herb-drug decision support summary", MARGIN, PAGE_HEIGHT - 66, {
        font: "F1",
        size: 10,
        color: [191, 219, 254],
        maxChars: 60,
        lineGap: 2
    });

    cursorY = PAGE_HEIGHT - 118;

    drawRect(commands, MARGIN, cursorY - 54, CONTENT_WIDTH, 54, {
        fill: [248, 250, 252],
        stroke: [203, 213, 225],
        lineWidth: 0.8
    });
    renderWrappedText(commands, `Patient: ${payload.patientName || "Patient_Record"}`, MARGIN + 14, cursorY - 18, {
        font: "F2",
        size: 11,
        color: [15, 23, 42],
        maxChars: 40,
        lineGap: 2
    });
    renderWrappedText(commands, `Age ${payload.patientAge || "0"}   |   Renal ${payload.renalStatus || "Normal"}   |   Liver ${payload.liverStatus || "Normal"}`, MARGIN + 14, cursorY - 35, {
        font: "F1",
        size: 10,
        color: [71, 85, 105],
        maxChars: 75,
        lineGap: 2
    });
    renderWrappedText(commands, `Generated ${new Date().toLocaleString()}`, PAGE_WIDTH - 190, cursorY - 18, {
        font: "F1",
        size: 9,
        color: [100, 116, 139],
        maxChars: 24,
        lineGap: 2
    });
    cursorY -= 72;

    drawRect(commands, MARGIN, cursorY - 58, CONTENT_WIDTH, 58, {
        fill: [239, 246, 255],
        stroke: [147, 197, 253],
        lineWidth: 0.8
    });
    renderWrappedText(commands, "Report Snapshot", MARGIN + 14, cursorY - 18, {
        font: "F2",
        size: 11,
        color: [29, 78, 216],
        maxChars: 30,
        lineGap: 2
    });
    renderWrappedText(commands, `Interactions ${summary.totalInteractions}   |   Highest Risk ${summary.highestRisk}/5   |   Verified ${summary.verifiedCount}   |   Inferred ${summary.inferredCount}`, MARGIN + 14, cursorY - 37, {
        font: "F1",
        size: 10,
        color: [15, 23, 42],
        maxChars: 84,
        lineGap: 2
    });
    cursorY -= 78;

    renderWrappedText(commands, "Clinical Note", MARGIN, cursorY, {
        font: "F2",
        size: 11,
        color: [15, 23, 42],
        maxChars: 24,
        lineGap: 2
    });
    cursorY -= 16;

    const noteLines = wrapText(payload.noteText || "", 88);
    drawRect(commands, MARGIN, cursorY - ((noteLines.length * 14) + 14), CONTENT_WIDTH, (noteLines.length * 14) + 14, {
        fill: [255, 255, 255],
        stroke: [226, 232, 240],
        lineWidth: 0.8
    });
    renderWrappedText(commands, payload.noteText || "", MARGIN + 12, cursorY - 16, {
        font: "F1",
        size: 10,
        color: [51, 65, 85],
        maxChars: 86,
        lineGap: 4
    });
    cursorY -= ((noteLines.length * 14) + 28);

    pageResults.forEach((result, index) => {
        const riskLevel = Number(result.risk_level || 0);
        const palette = riskPalette(riskLevel);
        const cardHeight = estimateResultHeight(result);

        drawRect(commands, MARGIN, cursorY - cardHeight, CONTENT_WIDTH, cardHeight, {
            fill: [255, 255, 255],
            stroke: [226, 232, 240],
            lineWidth: 0.9
        });
        drawRect(commands, MARGIN, cursorY - cardHeight, 8, cardHeight, {
            fill: palette.border
        });

        renderWrappedText(commands, `Result ${pageIndex === 0 ? index + 1 : (pageIndex * 10) + index + 1}`, MARGIN + 18, cursorY - 20, {
            font: "F2",
            size: 9,
            color: [100, 116, 139],
            maxChars: 24,
            lineGap: 2
        });
        renderWrappedText(commands, `${(result.herb_name || "").toUpperCase()} + ${(result.drug_name || "").toUpperCase()}`, MARGIN + 18, cursorY - 36, {
            font: "F2",
            size: 14,
            color: [15, 23, 42],
            maxChars: 46,
            lineGap: 3
        });
        renderWrappedText(commands, result.scientific_name || result.drug_class || "Clinical pair analysis", MARGIN + 18, cursorY - 54, {
            font: "F1",
            size: 9,
            color: [100, 116, 139],
            maxChars: 62,
            lineGap: 2
        });

        drawRect(commands, PAGE_WIDTH - 154, cursorY - 38, 88, 22, {
            fill: palette.fill
        });
        renderWrappedText(commands, `Risk ${riskLevel}/5`, PAGE_WIDTH - 132, cursorY - 23, {
            font: "F2",
            size: 9,
            color: palette.text,
            maxChars: 12,
            lineGap: 2
        });
        renderWrappedText(commands, `${result.risk_label || palette.label} | ${result.source_type || "Dynamic Analysis"}`, PAGE_WIDTH - 154, cursorY - 56, {
            font: "F1",
            size: 8,
            color: [71, 85, 105],
            maxChars: 28,
            lineGap: 2
        });

        let textY = cursorY - 78;
        const blocks = [
            { label: "Clinical Effect", value: result.clinical_effect || "N/A" },
            { label: "Mechanism", value: result.mechanism || "N/A" },
            { label: "Monitoring", value: result.monitoring || "Routine monitoring advised." },
            { label: "Recommendation", value: result.clinical_recommendation || result.recommendation || "Consult a healthcare professional." }
        ];

        if (result.reference) {
            blocks.push({ label: "Reference", value: result.reference });
        }

        blocks.forEach((block) => {
            renderWrappedText(commands, `${block.label}:`, MARGIN + 18, textY, {
                font: "F2",
                size: 9,
                color: [15, 23, 42],
                maxChars: 20,
                lineGap: 2
            });
            const consumed = renderWrappedText(commands, block.value, MARGIN + 102, textY, {
                font: "F1",
                size: 9,
                color: block.label === "Reference" ? [37, 99, 235] : [51, 65, 85],
                maxChars: 72,
                lineGap: 3
            });
            textY -= Math.max(consumed, 14);
        });

        cursorY -= cardHeight + 16;
    });

    renderWrappedText(commands, `Page ${pageIndex + 1} of ${pageCount}`, PAGE_WIDTH - 88, 22, {
        font: "F1",
        size: 9,
        color: [148, 163, 184],
        maxChars: 16,
        lineGap: 2
    });

    return commands.join("\n");
}

function assemblePdf(objects) {
    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets[index + 1] = pdf.length;
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";

    for (let i = 1; i <= objects.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "binary");
}

function chunkResults(results) {
    const pages = [];
    let current = [];
    let usedHeight = 0;
    const availableHeight = 360;

    results.forEach((result) => {
        const cardHeight = estimateResultHeight(result) + 16;
        if (current.length > 0 && usedHeight + cardHeight > availableHeight) {
            pages.push(current);
            current = [];
            usedHeight = 0;
        }

        current.push(result);
        usedHeight += cardHeight;
    });

    if (current.length === 0) current.push(...results.slice(0, 1));
    if (current.length > 0) pages.push(current);
    return pages;
}

function generateClinicalReportPdf(payload) {
    const results = payload.results || [];
    const pagedResults = chunkResults(results);
    const objects = [];

    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push("PAGES_PLACEHOLDER");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    const pageObjectNumbers = [];

    pagedResults.forEach((pageResults, pageIndex) => {
        const content = renderPage(pageResults, payload, pageIndex, pagedResults.length);
        const contentObjectNumber = objects.length + 1;
        objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

        const pageObjectNumber = objects.length + 1;
        pageObjectNumbers.push(pageObjectNumber);
        objects.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
        );
    });

    objects[1] = `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] >>`;
    return assemblePdf(objects);
}

module.exports = {
    generateClinicalReportPdf
};
