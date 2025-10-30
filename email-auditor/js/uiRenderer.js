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
        Reason: "Consecutive ®® symbols detected",
        Snippet: item['Text Content'],
        element: item.element
    }))
];

const checks = [
    { title: `Universal '${config.parameterName}' Validation`, data: [ ...results.sc_cid_malformed.map(l => ({ "Failure Reason": "Malformed (not in query string)", "Link URL": l.href, "Link Text": l.innerText.trim() })), ...results.sc_cid_missing.map(l => ({ "Failure Reason": "Missing ID", "Link URL": l.href, "Link Text": l.innerText.trim() })), ...results.sc_cid_wrong_value.map(l => ({ "Failure Reason": `Wrong ID Value (Expected '${scCidValue}')`, "Link URL": l.href, "Link Text": l.innerText.trim() })), ...results.sc_cid_empty.map(l => ({ "Failure Reason": "ID Has No Value", "Link URL": l.href, "Link Text": l.innerText.trim() })), ...results.sc_cid_duplicate.map(l => ({ "Failure Reason": "Duplicate ID", "Link URL": l.href, "Link Text": l.innerText.trim() })) ], headers: ["Failure Reason", "Link URL", "Link Text"] },
    { title: "Duplicate HTML Attributes", data: results.duplicate_attributes, headers: ["Element", "Attribute", "Count"] },
    { title: "Trademark Formatting Issues", data: [...new Map(combinedTrademarkIssues.map(item => [item.Snippet, item])).values()], headers: ["Reason", "Snippet"] },
    { title: "Inaccessible 'Empty' Links", data: results.inaccessible.map(l => ({ "Link URL": l.href, "Outer HTML": l.outerHTML })), headers: ["Link URL", "Outer HTML"] },
    { title: "Insecure Links (http://)", data: results.insecure.map(l => ({ "Link URL": l.href, "Link Text": l.innerText.trim() })), headers: ["Link URL", "Link Text"] },
    { title: 'Links without target="_blank"', data: results.missingTargetBlank.map(l => ({ "Link URL": l.href, "Link Text": l.innerText.trim() })), headers: ["Link URL", "Link Text"] },
    { title: 'Validate "Red Hat" Spacing', data: results.redhat_spacing.map(f => ({ "Containing Element": f.element.tagName, "Text Snippet": f.snippet })), headers: ["Containing Element", "Text Snippet"] },
    { title: "Placeholder (Dummy) Text", data: results.dummy_text.map(f => ({ "Containing Element": f.element.tagName, "Text Snippet": f.snippet })), headers: ["Containing Element", "Text Snippet"] },
    { title: "Image Policy Violations", data: results.image_failures, headers: ["Failure Reasons", "Image Source", "Alt Text"] },
    { title: "Table Layout & Accessibility", data: results.table_failures, headers: ["Reason", "Table ID", "Table Class"] },
    { title: "Invalid Font Family", data: results.font_failures, headers: ["Element", "Text", "Invalid Font Stack"] },
    { title: "Invalid Link Color", data: results.link_color_failures, headers: ["Link Text", "Invalid Color"] },
    { title: 'Links with title="null"', data: results.title_null_failures, headers: ["Link Text", "Link URL"] },
    { title: "Invalid Background Image Source", data: results.background_image_failures, headers: ["Reason", "Invalid URL", "Element"] },
    { title: "Extra Whitespace", data: [ ...[...new Map(results.extra_space_text.map(item => [item.Snippet, item])).values()].map(f => ({ "Type": "Text", "Details": f.Snippet, "Value": "" })), ...results.extra_space_attributes.map(f => ({ "Type": "Attribute", "Details": `${f.Element} -> ${f.Attribute}`, "Value": f['Problematic Value'] })) ], headers: ["Type", "Details", "Value"] }
];

let totalIssues = 0;
const accordion = document.createElement('div');
accordion.className = 'accordion';
accordion.id = 'resultsAccordion';

const createTable = (headers, data) => {
    if (data.length === 0) return '';
    let tableHtml = '<div class="table-responsive"><table class="table table-sm table-bordered table-dark"><thead><tr>';
    headers.forEach(h => tableHtml += `<th>${h}</th>`);
    tableHtml += '</tr></thead><tbody>';
    data.forEach(row => {
        tableHtml += '<tr>';
        headers.forEach(h => {
            // ##################################################################
            // ###                      THE FIX IS HERE                       ###
            // ##################################################################
            // We use a direct property lookup, which is simple and correct.
            // The previous complex logic was flawed and has been removed.
            const value = row[h] || '';
            tableHtml += `<td>${escapeHtml(String(value))}</td>`;
            // ##################################################################
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table></div>';
    return tableHtml;
};

checks.forEach((check, index) => {
    const issueCount = check.data.length;
    totalIssues += issueCount;
    const isFail = issueCount > 0;
    const id = `collapse${index}`, headerId = `heading${index}`;
    const headerContent = `${check.title}<span class="badge rounded-pill ms-auto">${isFail ? issueCount + ' Issues' : 'Passed'}</span>`;
    const headerTag = isFail 
        ? `<button class="accordion-button text-bg-danger" type="button" data-bs-toggle="collapse" data-bs-target="#${id}">${headerContent}</button>`
        : `<div class="accordion-button collapsed text-bg-success">${headerContent}</div>`;
    const item = `<div class="accordion-item"><h2 class="accordion-header" id="${headerId}">${headerTag}</h2>${isFail ? `<div id="${id}" class="accordion-collapse collapse show" data-bs-parent="#resultsAccordion"><div class="accordion-body">${createTable(check.headers, check.data)}</div></div>` : ''}</div>`;
    accordion.innerHTML += item;
});
if (totalIssues === 0) {
     targetPanel.innerHTML = `<div class="alert alert-success" role="alert"><strong>Excellent!</strong> All checks passed.</div>`;
} else {
    targetPanel.appendChild(accordion);
}
}