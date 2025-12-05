import { dom } from './dom.js';
import { config } from './config.js';
import { escapeHtml } from './utils.js';

export function renderResults(results, scCidValue, hasHtmlContent) {
const targetPanel = dom.resultsPanel;
targetPanel.innerHTML = '';
if (!hasHtmlContent) {
    targetPanel.innerHTML = `<div class="alert alert-secondary" role="alert">Results will appear here once you paste HTML code.</div>`;
    return;
}

const combinedTrademarkIssues = [
    ...results.trademark_failures,
    ...results.consecutive_trademarks.map(item => ({
        Reason: "Consecutive ® ® symbols detected",
        Snippet: item.Snippet,
        element: item.element
    }))
];

const createTable = (headers, data) => {
    if (!data || data.length === 0) return '<p class="text-muted">No issues found.</p>';
    let tableHtml = '<div class="table-responsive"><table class="table table-striped table-sm">';
    tableHtml += '<thead><tr>';
    headers.forEach(h => tableHtml += `<th>${h}</th>`);
    tableHtml += '</tr></thead><tbody>';
    data.forEach(row => {
        tableHtml += '<tr>';
        headers.forEach(h => {
            const key = h.replace(/\s/g, '_'); // Create a key from the header
            const value = row[h] || row[key] || '';
            tableHtml += `<td>${escapeHtml(String(value))}</td>`;
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table></div>';
    return tableHtml;
};

// The 'checks' array is now a mix of simple objects and one complex object for the combined view
const checks = [
    {
        title: "HTML Structural Integrity",
        data: results.structural_failures,
        headers: ["Reason", "Snippet", "Line"],
        renderer: (data, headers) => createTable(headers, data)
    },
    {
        title: "Malformed HTML Syntax",
        data: results.malformed_html_failures,
        headers: ["Reason", "Snippet", "Line"],
        renderer: (data, headers) => createTable(headers, data)
    }, 
    {
        title: `Universal '${config.parameterName}' Validation`,
        data: [
            ...results.sc_cid_malformed.map(l => ({ "Failure Reason": "Malformed (not in query string)", "Link URL": l.href, "Link Text": l.innerText.trim() })),
            ...results.sc_cid_missing.map(l => ({ "Failure Reason": "Missing ID", "Link URL": l.href, "Link Text": l.innerText.trim() })),
            ...results.sc_cid_wrong_value.map(l => ({ "Failure Reason": `Wrong ID Value (Expected '${scCidValue}')`, "Link URL": l.href, "Link Text": l.innerText.trim() })),
            ...results.sc_cid_empty.map(l => ({ "Failure Reason": "ID Has No Value", "Link URL": l.href, "Link Text": l.innerText.trim() })),
            ...results.sc_cid_duplicate.map(l => ({ "Failure Reason": "Duplicate ID", "Link URL": l.href, "Link Text": l.innerText.trim() }))
        ],
        headers: ["Failure Reason", "Link URL", "Link Text"],
        renderer: (data, headers) => createTable(headers, data)
    }, 
    // MODIFIED: A new combined check for images and linked images
    {
        title: "Image & Link Compliance",
        data: [...results.image_failures, ...results.linked_image_failures], // Combine data just for issue counting
        renderer: () => {
            const imageTable = `<h6>Image Policy Violations</h6>${createTable(["Failure Reasons", "Image Source", "Alt Text"], results.image_failures)}`;
            const linkedImageTable = `<h6 class="mt-4">Linked Image Violations</h6>${createTable(["Reason", "Link Href", "Contained Image"], results.linked_image_failures)}`;
            return `${imageTable}${linkedImageTable}`;
        }
    },
    {
        title: "Trademark & Symbol Validation",
        data: [...new Map(combinedTrademarkIssues.map(item => [item.Snippet, item])).values()],
        headers: ["Reason", "Snippet"],
        renderer: (data, headers) => createTable(headers, data)
    }, 
    // ... all other checks remain the same, but get a default renderer
];

// Add default renderer to other checks that don't have one
const defaultChecks = [
    { title: "Duplicate HTML Attributes", data: results.duplicate_attributes, headers: ["Element", "Attribute", "Line"] },
    { title: "Inaccessible 'Empty' Links", data: results.inaccessible.map(l => ({ "Link URL": l.href, "Outer HTML": l.outerHTML })), headers: ["Link URL", "Outer HTML"] },
    { title: "Insecure Links (http://)", data: results.insecure.map(l => ({ "Link URL": l.href, "Link Text": l.innerText.trim() })), headers: ["Link URL", "Link Text"] },
    { title: 'Links without target="_blank"', data: results.missingTargetBlank.map(l => ({ "Link URL": l.href, "Link Text": l.innerText.trim() })), headers: ["Link URL", "Link Text"] },
    { title: 'Validate "Red Hat" Spacing', data: results.redhat_spacing.map(f => ({ "Containing Element": f.element.tagName, "Text Snippet": f.snippet })), headers: ["Containing Element", "Text Snippet"] },
    { title: "Placeholder (Dummy) Text", data: results.dummy_text.map(f => ({ "Containing Element": f.element.tagName, "Text Snippet": f.snippet })), headers: ["Containing Element", "Text Snippet"] },
    { title: "Table Layout & Accessibility", data: results.table_failures, headers: ["Reason", "Table ID", "Table Class"] },
    { title: "Invalid Font Family", data: results.font_failures, headers: ["Element", "Text", "Invalid Font Stack"] },
    { title: "Invalid Link Color", data: results.link_color_failures, headers: ["Link Text", "Invalid Color"] },
    { title: 'Links with title="null"', data: results.title_null_failures, headers: ["Link Text", "Link URL"] },
    { title: "Invalid Background Image Source", data: results.background_image_failures, headers: ["Reason", "Invalid URL", "Element"] },
    { title: "Extra Whitespace", data: [...[...new Map(results.extra_space_text.map(item => [item.Snippet, item])).values()].map(f => ({ "Type": "Text", "Details": f.Snippet, "Value": "" })), ...results.extra_space_attributes.map(f => ({ "Type": "Attribute", "Details": `${f.Element} -> ${f.Attribute}`, "Value": f['Problematic Value'] }))], headers: ["Type", "Details", "Value"] }
];

defaultChecks.forEach(c => checks.push({ ...c, renderer: (data, headers) => createTable(headers, data) }));

let totalIssues = 0;
const accordion = document.createElement('div');
accordion.className = 'accordion';
accordion.id = 'resultsAccordion';

checks.sort((a, b) => a.title.localeCompare(b.title)).forEach((check, index) => {
    if (!check || !check.data) return;
    const issueCount = check.data.length;
    totalIssues += issueCount;
    const isFail = issueCount > 0;
    const id = `collapse${index}`, headerId = `heading${index}`;
    const headerContent = `${check.title}<span class="badge rounded-pill ms-auto">${isFail ? issueCount + ' Issues' : 'Passed'}</span>`;
    
    const headerTag = isFail ?
        `<button class="accordion-button collapsed text-bg-danger" type="button" data-bs-toggle="collapse" data-bs-target="#${id}">${headerContent}</button>` :
        `<div class="accordion-button collapsed text-bg-success">${headerContent}</div>`;
    
    const bodyContent = isFail ? check.renderer(check.data, check.headers) : '';
    const item = `<div class="accordion-item"><h2 class="accordion-header" id="${headerId}">${headerTag}</h2>${isFail ? `<div id="${id}" class="accordion-collapse collapse" data-bs-parent="#resultsAccordion"><div class="accordion-body">${bodyContent}</div></div>` : ''}</div>`;

    accordion.innerHTML += item;
});

if (totalIssues === 0) {
    targetPanel.innerHTML = `<div class="alert alert-success" role="alert"><strong>Excellent!</strong> All checks passed.</div>`;
} else {
    targetPanel.appendChild(accordion);
}
}
