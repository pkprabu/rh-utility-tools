import { dom }        from './dom.js';
import { config }     from './config.js';
import { escapeHtml } from './utils.js';
const SEVERITY = {
error:   { cls: 'text-bg-danger',  label: 'Error'   },
warning: { cls: 'text-bg-warning', label: 'Warning' },
info:    { cls: 'text-bg-info',    label: 'Info'    },
disabled:{ cls: 'text-bg-secondary', label: 'Disabled' },
};
function buildTable(headers, data, elementRefs) {
if (data.length === 0) return '';
const headerRow = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
const bodyRows  = data.map((row, i) => {
const cells = headers.map((h) => `<td>${escapeHtml(String(row[h] ?? ''))}</td>`).join('');
const ref   = elementRefs && elementRefs[i] ? ` data-element-ref="${i}" style="cursor:pointer;" title="Click to highlight element"` : '';
return `<tr${ref}>${cells}</tr>`;
}).join('');
return `
<div class="table-responsive">
<table class="table table-striped table-sm">
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</div>`;
}
function buildAccordionItem({ title, index, headers, data, severity, elementRefs, disabled }) {
if (disabled) {
return `
<div class="accordion-item">
<h2 class="accordion-header">
<div class="accordion-button collapsed text-bg-secondary disabled-check-row"
style="cursor:default; opacity:0.7;">
${escapeHtml(title)}
<span class="badge rounded-pill ms-auto bg-secondary border border-light border-opacity-25">Disabled</span>
</div>
</h2>
</div>`;
}
const count     = data.length;
const isFail    = count > 0;
const id        = `collapse${index}`;
const sev       = SEVERITY[severity] || SEVERITY.error;
const headerCls = isFail ? sev.cls : 'text-bg-success';
const badge     = `<span class="badge rounded-pill ms-auto">${isFail ? `${count} Issues` : 'Passed'}</span>`;
const label     = `${escapeHtml(title)}${badge}`;
if (isFail) {
return `
<div class="accordion-item">
<h2 class="accordion-header">
<button class="accordion-button collapsed ${headerCls}"
type="button" data-bs-toggle="collapse" data-bs-target="#${id}">
${label}
</button>
</h2>
<div id="${id}" class="accordion-collapse collapse" data-bs-parent="#resultsAccordion">
<div class="accordion-body">${buildTable(headers, data, elementRefs)}</div>
</div>
</div>`;
}
return `
<div class="accordion-item">
<h2 class="accordion-header">
<div class="accordion-button collapsed text-bg-success">${label}</div>
</h2>
</div>`;
}
function combinedTrademarkData(results) {
const merged = [
...results.trademark_failures,
...results.consecutive_trademarks.map((item) => ({
Reason: 'Consecutive ® ® symbols detected', Snippet: item.Snippet, element: item.element,
})),
];
return [...new Map(merged.map((item) => [item.Snippet, item])).values()];
}
function scCidTableData(results, scCidValue) {
return [
...results.sc_cid_malformed.map((item) => ({ 'Failure Reason': item.reason || 'Malformed', 'Link URL': item.link ? item.link.href : (item.href || ''), 'Link Text': item.link ? item.link.innerText.trim() : '' })),
...results.sc_cid_missing.map((l)    => ({ 'Failure Reason': 'Missing ID',                              'Link URL': l.href, 'Link Text': l.innerText.trim() })),
...results.sc_cid_wrong_value.map((l) => ({ 'Failure Reason': `Wrong Value (Expected '${scCidValue}')`, 'Link URL': l.href, 'Link Text': l.innerText.trim() })),
...results.sc_cid_empty.map((l)      => ({ 'Failure Reason': 'ID Has No Value',                         'Link URL': l.href, 'Link Text': l.innerText.trim() })),
...results.sc_cid_duplicate.map((l)  => ({ 'Failure Reason': 'Duplicate ID',                            'Link URL': l.href, 'Link Text': l.innerText.trim() })),
];
}
function extraWhitespaceData(results) {
const textRows = [...new Map(results.extra_space_text.map((item) => [item.Snippet, item])).values()]
.map((f) => ({ Type: 'Text', Details: f.Snippet, Value: '' }));
const attrRows = results.extra_space_attributes
.map((f) => ({ Type: 'Attribute', Details: `${f.Element} -> ${f.Attribute}`, Value: f['Problematic Value'] }));
return [...textRows, ...attrRows];
}
function buildChecks(results, scCidValue, disabledKeys = new Set()) {
const p = config.parameterName;
return [
{ key: 'structural_failures',      title: 'HTML Structural Integrity',              severity: 'error',   headers: ['Reason','Snippet','Line'],                        data: results.structural_failures },
{ key: 'malformed_html_failures',  title: 'Malformed HTML Syntax',                  severity: 'error',   headers: ['Reason','Snippet','Line'],                        data: results.malformed_html_failures },
{ key: 'javascript_detected',      title: 'JavaScript Detected',                     severity: 'error',   headers: ['Reason','Snippet'],                              data: results.javascript_detected },
{ key: 'iframe_detected',          title: 'Iframes Detected',                        severity: 'error',   headers: ['Reason','Snippet'],                              data: results.iframe_detected },
{ key: 'form_elements',            title: 'Form Elements Detected',                  severity: 'error',   headers: ['Element','Reason','Snippet'],                    data: results.form_elements },
{ key: 'insecure',                 title: 'Insecure Links (http://)',                 severity: 'error',   headers: ['Link URL','Link Text'],                          data: results.insecure.map((l) => ({ 'Link URL': l.href, 'Link Text': l.innerText.trim() })) },
{ key: 'sc_cid',                   title: `Universal '${p}' Validation`,             severity: 'error',   headers: ['Failure Reason','Link URL','Link Text'],          data: scCidTableData(results, scCidValue) },
{ key: 'duplicate_attributes',     title: 'Duplicate HTML Attributes',               severity: 'error',   headers: ['Element','Attribute','Line'],                    data: results.duplicate_attributes },
{ key: 'duplicate_ids',            title: 'Duplicate Element IDs',                   severity: 'error',   headers: ['Duplicate ID','Element','Snippet'],              data: results.duplicate_ids },
{ key: 'nested_anchors',           title: 'Nested Anchor Tags',                      severity: 'error',   headers: ['Reason','Outer URL','Inner URL','Snippet'],       data: results.nested_anchors },
{ key: 'email_size_warning',       title: 'Email File Size Warning',                 severity: 'error',   headers: ['Reason','Size','Threshold'],                     data: results.email_size_warning },
{ key: 'image_failures',           title: 'Image Policy Violations',                 severity: 'error',   headers: ['Failure Reasons','Image Source','Alt Text'],     data: results.image_failures,         elementRefs: results.image_failures.map((i) => i.element) },
{ key: 'table_failures',           title: 'Table Layout & Accessibility',            severity: 'error',   headers: ['Reason','Table ID','Table Class'],               data: results.table_failures,         elementRefs: results.table_failures.map((i) => i.element) },
{ key: 'trademark_failures',       title: 'Trademark Formatting Issues',             severity: 'error',   headers: ['Reason','Snippet'],                              data: combinedTrademarkData(results) },
{ key: 'nested_sup_failures',      title: 'Nested Trademark Tags',                   severity: 'error',   headers: ['Reason','Snippet'],                              data: results.nested_sup_failures },
{ key: 'style_blocks',             title: 'Inline CSS Required (<style> Detected)',  severity: 'warning', headers: ['Reason','Snippet'],                              data: results.style_blocks },
{ key: 'video_audio_elements',     title: 'Unsupported Media Elements',              severity: 'warning', headers: ['Element','Reason','Snippet'],                    data: results.video_audio_elements },
{ key: 'inaccessible',             title: "Inaccessible 'Empty' Links",              severity: 'warning', headers: ['Link URL','Outer HTML'],                         data: results.inaccessible.map((l) => ({ 'Link URL': l.href, 'Outer HTML': l.outerHTML })) },
{ key: 'empty_href',               title: 'Empty href Attributes',                   severity: 'warning', headers: ['Link Text','Snippet'],                           data: results.empty_href.map((i) => ({ 'Link Text': i['Link Text'], Snippet: i.Snippet })) },
{ key: 'missingTargetBlank',       title: 'Links without target="_blank"',           severity: 'warning', headers: ['Link URL','Link Text'],                          data: results.missingTargetBlank.map((l) => ({ 'Link URL': l.href, 'Link Text': l.innerText.trim() })) },
{ key: 'missingNoopener',          title: 'Links missing rel="noopener noreferrer"', severity: 'warning', headers: ['Link URL','Link Text'],                          data: (results.missingNoopener || []).map((l) => ({ 'Link URL': l.href, 'Link Text': l.innerText.trim() })) },
{ key: 'link_color_failures',      title: 'Invalid Link Color',                      severity: 'warning', headers: ['Link Text','Invalid Color'],                     data: results.link_color_failures },
{ key: 'title_null_failures',      title: 'Links with title="null"',                 severity: 'warning', headers: ['Link Text','Link URL'],                          data: results.title_null_failures },
{ key: 'font_failures',            title: 'Invalid Font Family',                     severity: 'warning', headers: ['Element','Text','Invalid Font Stack'],           data: results.font_failures },
{ key: 'font_size_failures',       title: 'Font Size Below Minimum',                 severity: 'warning', headers: ['Element','Font Size','Minimum','Text'],          data: results.font_size_failures,     elementRefs: results.font_size_failures.map((i) => i.element) },
{ key: 'line_height_failures',     title: 'Low Line Height',                         severity: 'warning', headers: ['Element','Line Height','Minimum','Text'],        data: results.line_height_failures,   elementRefs: results.line_height_failures.map((i) => i.element) },
{ key: 'unsupported_css',          title: 'Unsupported CSS Properties',              severity: 'warning', headers: ['Element','Property','Snippet'],                  data: results.unsupported_css,        elementRefs: results.unsupported_css.map((i) => i.element) },
{ key: 'css_important',            title: 'CSS !important Usage',                    severity: 'warning', headers: ['Element','Snippet'],                             data: results.css_important,          elementRefs: results.css_important.map((i) => i.element) },
{ key: 'background_image',         title: 'Invalid Background Image Source',         severity: 'error',   headers: ['Reason','Invalid URL','Element'],                data: results.background_image_failures },
{ key: 'broken_image_src',         title: 'Broken / Placeholder Image Sources',      severity: 'warning', headers: ['Reason','Image Source'],                         data: results.broken_image_src,       elementRefs: results.broken_image_src.map((i) => i.element) },
{ key: 'spacer_images',            title: 'Spacer Images Detected',                  severity: 'warning', headers: ['Reason','Image Source','Dimensions'],            data: results.spacer_images,          elementRefs: results.spacer_images.map((i) => i.element) },
{ key: 'relative_src_urls',        title: 'Relative src= URLs',                      severity: 'warning', headers: ['Element','Relative src','Reason'],               data: results.relative_src_urls,      elementRefs: results.relative_src_urls.map((i) => i.element) },
{ key: 'email_width_violations',   title: 'Email Width Violations',                  severity: 'warning', headers: ['Element','Width Found','Max Allowed','Snippet'], data: results.email_width_violations,  elementRefs: results.email_width_violations.map((i) => i.element) },
{ key: 'redhat_spacing',           title: 'Validate "Red Hat" Spacing',              severity: 'warning', headers: ['Containing Element','Text Snippet'],             data: results.redhat_spacing.map((f) => ({ 'Containing Element': f.element.tagName, 'Text Snippet': f.snippet })) },
{ key: 'dummy_text',               title: 'Placeholder (Dummy) Text',                severity: 'warning', headers: ['Containing Element','Text Snippet'],             data: results.dummy_text.map((f) => ({ 'Containing Element': f.element.tagName, 'Text Snippet': f.snippet })) },
{ key: 'extra_space',              title: 'Extra Whitespace',                        severity: 'warning', headers: ['Type','Details','Value'],                        data: extraWhitespaceData(results) },
{ key: 'commented_code',           title: 'Commented-Out Code',                      severity: 'warning', headers: ['Reason','Snippet'],                              data: results.commented_code },
{ key: 'missing_lang',             title: 'Missing lang Attribute',                  severity: 'info',    headers: ['Reason','Snippet'],                              data: results.missing_lang },
{ key: 'missing_title',            title: 'Missing <title> Tag',                     severity: 'info',    headers: ['Reason'],                                        data: results.missing_title },
{ key: 'missing_meta_charset',     title: 'Missing <meta charset>',                  severity: 'info',    headers: ['Reason'],                                        data: results.missing_meta_charset },
{ key: 'missing_viewport_meta',    title: 'Missing Viewport Meta Tag',               severity: 'info',    headers: ['Reason'],                                        data: results.missing_viewport_meta },
{ key: 'missing_preheader',        title: 'Missing Preheader Text',                  severity: 'info',    headers: ['Reason'],                                        data: results.missing_preheader },
{ key: 'missing_unsubscribe',      title: 'Missing Unsubscribe Link',                severity: 'info',    headers: ['Reason'],                                        data: results.missing_unsubscribe },
{ key: 'missing_physical_address', title: 'Missing Physical Address',                severity: 'info',    headers: ['Reason'],                                        data: results.missing_physical_address },
].map((check) => {
if (disabledKeys.has(check.key)) {
return { ...check, disabled: true };
}
return check;
});
}
function buildSummaryBar(checks) {
let errors = 0, warnings = 0, passed = 0, disabled = 0;
checks.forEach((c) => {
if (c.disabled)                { disabled++; return; }
if (c.data.length === 0)       { passed++;   return; }
if (c.severity === 'error')    errors   += c.data.length;
if (c.severity === 'warning')  warnings += c.data.length;
});
return `
<div class="d-flex gap-2 mb-3 flex-wrap align-items-center" id="summary-bar">
${errors   ? `<span class="badge text-bg-danger   fs-6 px-3 py-2">${errors} Error${errors !== 1 ? 's' : ''}</span>`     : ''}
${warnings ? `<span class="badge text-bg-warning  fs-6 px-3 py-2">${warnings} Warning${warnings !== 1 ? 's' : ''}</span>` : ''}
<span class="badge text-bg-success  fs-6 px-3 py-2">${passed} Passed</span>
${disabled ? `<span class="badge text-bg-secondary fs-6 px-3 py-2">${disabled} Disabled</span>` : ''}
<button class="btn btn-sm btn-outline-secondary ms-auto" id="export-pdf-btn" type="button">Export PDF</button>
</div>`;
}
export function exportResultsPdf(checks, scCidValue) {
if (!window.jspdf || !window.jspdf.jsPDF) {
alert('PDF library not loaded. Please check your internet connection and try again.');
return;
}
const { jsPDF } = window.jspdf;
const PAGE_W    = 210;  // A4 mm
const PAGE_H    = 297;
const ML        = 14;   // margin left
const MR        = 14;   // margin right
const MT        = 14;   // margin top
const MB        = 14;   // margin bottom
const CW        = PAGE_W - ML - MR;  // content width = 182mm
const BOTTOM    = PAGE_H - MB;
const SEV = {
error:   { bg: '#f8d7da', border: '#dc3545', text: '#842029', badgeBg: '#dc3545' },
warning: { bg: '#fff3cd', border: '#ffc107', text: '#664d03', badgeBg: '#997404' },
info:    { bg: '#cfe2ff', border: '#0dcaf0', text: '#084298', badgeBg: '#0dcaf0' },
passed:  { bg: '#d1e7dd', border: '#198754', text: '#0f5132', badgeBg: '#198754' },
};
const doc  = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
let y       = MT;
let pageNum = 1;
const pageRefs = []; // track y-offsets per page for footer
function hex2rgb(hex) {
const n = parseInt(hex.replace('#', ''), 16);
return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function setFill(hex) {
const [r, g, b] = hex2rgb(hex);
doc.setFillColor(r, g, b);
}
function setTextColor(hex) {
const [r, g, b] = hex2rgb(hex);
doc.setTextColor(r, g, b);
}
function setDrawColor(hex) {
const [r, g, b] = hex2rgb(hex);
doc.setDrawColor(r, g, b);
}
function addPage() {
drawFooter();
doc.addPage();
pageNum++;
y = MT;
}
function ensureSpace(needed) {
if (y + needed > BOTTOM) addPage();
}
function drawFooter() {
const footerY = PAGE_H - 8;
doc.setFontSize(7);
setTextColor('#6c757d');
doc.text('Email Auditor v1.1.0', ML, footerY);
doc.text(`Page ${pageNum}`, PAGE_W / 2, footerY, { align: 'center' });
const d = new Date().toLocaleDateString();
doc.text(d, PAGE_W - MR, footerY, { align: 'right' });
setDrawColor('#dee2e6');
doc.setLineWidth(0.1);
doc.line(ML, footerY - 3, PAGE_W - MR, footerY - 3);
}
function truncate(text, maxW, fontSize) {
doc.setFontSize(fontSize);
const str = String(text ?? '');
if (doc.getTextWidth(str) <= maxW) return str;
let truncated = str;
while (truncated.length > 0 && doc.getTextWidth(truncated + '\u2026') > maxW) {
truncated = truncated.slice(0, -1);
}
return truncated + '\u2026';
}
let errors = 0, warnings = 0, infoCount = 0, passed = 0;
checks.forEach((c) => {
if (c.data.length === 0) { passed++; return; }
if (c.severity === 'error')   errors   += c.data.length;
if (c.severity === 'warning') warnings += c.data.length;
if (c.severity === 'info')    infoCount += c.data.length;
});
const HDR_H = 18;
setFill('#1a1a2e');
doc.rect(0, 0, PAGE_W, HDR_H, 'F');
doc.setFont('helvetica', 'bold');
doc.setFontSize(14);
setTextColor('#ffffff');
doc.text('Email Audit Report', ML, 11);
const now = new Date().toLocaleString();
doc.setFont('helvetica', 'normal');
doc.setFontSize(7.5);
setTextColor('#adb5bd');
doc.text(`${now}  |  sc_cid: ${scCidValue || '(not provided)'}`, PAGE_W - MR, 11, { align: 'right' });
y = HDR_H + 8;
const CARD_W = 40, CARD_H = 18, CARD_GAP = 4;
const CARDS_TOTAL = 4 * CARD_W + 3 * CARD_GAP;
let cx = ML + (CW - CARDS_TOTAL) / 2;
const cards = [
{ label: 'Errors',   value: errors,   ...SEV.error   },
{ label: 'Warnings', value: warnings, ...SEV.warning  },
{ label: 'Info',     value: infoCount,...SEV.info    },
{ label: 'Passed',   value: passed,   ...SEV.passed  },
];
cards.forEach((card) => {
setFill(card.bg);
setDrawColor(card.border);
doc.setLineWidth(0.4);
doc.roundedRect(cx, y, CARD_W, CARD_H, 2, 2, 'FD');
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
setTextColor(card.text);
doc.text(String(card.value), cx + CARD_W / 2, y + 10, { align: 'center' });
doc.setFont('helvetica', 'normal');
doc.setFontSize(7);
doc.text(card.label, cx + CARD_W / 2, y + 15.5, { align: 'center' });
cx += CARD_W + CARD_GAP;
});
y += CARD_H + 8;
const SEC_HDR_H  = 8;   // section header bar height
const ROW_H      = 6;   // table row height
const TBL_HDR_H  = 7;   // table header row height
const CELL_PAD   = 2;   // cell left padding
checks.forEach((check) => {
const hasFail  = check.data.length > 0;
const colors   = hasFail ? (SEV[check.severity] || SEV.error) : SEV.passed;
const rowCount      = hasFail ? check.data.length : 0;
const estimatedH    = SEC_HDR_H + (hasFail ? TBL_HDR_H + rowCount * ROW_H + 2 : 0);
const minBlockH     = SEC_HDR_H + (hasFail ? TBL_HDR_H + Math.min(rowCount, 3) * ROW_H : 0);
ensureSpace(minBlockH + 3);
setFill(colors.bg);
setDrawColor(colors.border);
doc.setLineWidth(0.3);
doc.rect(ML, y, CW, SEC_HDR_H, 'FD');
setFill(colors.border);
doc.rect(ML, y, 3, SEC_HDR_H, 'F');
doc.setFont('helvetica', 'bold');
doc.setFontSize(8.5);
setTextColor(colors.text);
doc.text(truncate(check.title, CW - 50, 8.5), ML + 5, y + 5.5);
const badgeText = hasFail ? `${check.data.length} Issue${check.data.length !== 1 ? 's' : ''} \u00B7 ${check.severity.toUpperCase()}` : 'PASSED';
const badgeW    = Math.max(doc.getTextWidth(badgeText) + 5, 22);
const badgeX    = ML + CW - badgeW - 1;
const badgeY    = y + 1.5;
setFill(colors.badgeBg);
doc.setLineWidth(0);
doc.roundedRect(badgeX, badgeY, badgeW, 5, 1, 1, 'F');
doc.setFont('helvetica', 'bold');
doc.setFontSize(6.5);
setTextColor('#ffffff');
doc.text(badgeText, badgeX + badgeW / 2, badgeY + 3.5, { align: 'center' });
y += SEC_HDR_H;
if (!hasFail) {
y += 3;
return;
}
const headers  = check.headers;
const numCols  = headers.length;
const WIDE_COLS  = new Set(['Link URL', 'Snippet', 'Outer HTML', 'Invalid Font Stack', 'Reason', 'Details']);
const MEDIUM_COLS = new Set(['Link Text', 'Image Source', 'Text', 'Failure Reasons', 'Text Snippet']);
let weights = headers.map((h) => WIDE_COLS.has(h) ? 3 : MEDIUM_COLS.has(h) ? 2 : 1);
const totalW  = weights.reduce((a, b) => a + b, 0);
const colWidths = weights.map((w) => (w / totalW) * CW);
ensureSpace(TBL_HDR_H + ROW_H);
setFill('#e9ecef');
setDrawColor('#ced4da');
doc.setLineWidth(0.1);
doc.rect(ML, y, CW, TBL_HDR_H, 'FD');
doc.setFont('helvetica', 'bold');
doc.setFontSize(7.5);
setTextColor('#343a40');
let cx2 = ML;
headers.forEach((h, i) => {
doc.text(truncate(h, colWidths[i] - CELL_PAD * 2, 7.5), cx2 + CELL_PAD, y + 5);
cx2 += colWidths[i];
});
y += TBL_HDR_H;
doc.setFont('helvetica', 'normal');
doc.setFontSize(7);
check.data.forEach((row, ri) => {
ensureSpace(ROW_H + 1);
if (ri % 2 === 0) {
setFill('#f8f9fa');
doc.setLineWidth(0);
doc.rect(ML, y, CW, ROW_H, 'F');
}
setDrawColor('#dee2e6');
doc.setLineWidth(0.1);
doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);
setTextColor('#212529');
let cx3 = ML;
headers.forEach((h, i) => {
const raw  = String(row[h] ?? '');
const cell = truncate(raw, colWidths[i] - CELL_PAD * 2, 7);
doc.text(cell, cx3 + CELL_PAD, y + 4.2);
cx3 += colWidths[i];
});
y += ROW_H;
});
setDrawColor(colors.border);
doc.setLineWidth(0.2);
const tableH = TBL_HDR_H + check.data.length * ROW_H;
doc.rect(ML, y - tableH, CW, tableH, 'D');
y += 4; // gap after section
});
drawFooter();
const dateStr = new Date().toISOString().slice(0, 10);
doc.save(`audit-report-${dateStr}.pdf`);
}
function renderDisabledBanner(checks, settingsBtnId = 'settings-btn') {
const host = document.getElementById('disabled-banner-host');
if (!host) return;
const disabledChecks = checks.filter((c) => c.disabled);
if (disabledChecks.length === 0) {
host.innerHTML = '';   // CSS :empty hides the host automatically
return;
}
const chips = disabledChecks.map((c) =>
`<span class="dis-chip">${escapeHtml(c.title)}</span>`
).join('');
host.innerHTML = `
<div id="disabled-checks-banner">
<svg class="ban-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13"
fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091
1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535
0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1
5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
</svg>
<span class="ban-label">${disabledChecks.length}&nbsp;check${disabledChecks.length !== 1 ? 's' : ''}&nbsp;disabled&nbsp;&mdash;</span>
<span class="chip-row">${chips}</span>
<button type="button" class="ban-btn"
onclick="document.getElementById('${escapeHtml(settingsBtnId)}').click()">
&#9998;&nbsp;Enable in Settings
</button>
</div>`;
}
let _lastChecks = [];
export function getLastChecks() { return _lastChecks; }
export function renderResults(results, scCidValue, hasHtmlContent, disabledKeys = new Set()) {
const panel = dom.resultsPanel;
panel.innerHTML = '';
if (!hasHtmlContent) {
renderDisabledBanner([]);          // clear banner
panel.innerHTML = '<div class="alert alert-secondary" role="alert">Results will appear here once you paste HTML code.</div>';
return;
}
const checks = buildChecks(results, scCidValue, disabledKeys);
_lastChecks  = checks;
renderDisabledBanner(checks);
const activeIssues = checks.filter((c) => !c.disabled).reduce((sum, c) => sum + c.data.length, 0);
const hasDisabled  = checks.some((c) => c.disabled);
if (activeIssues === 0 && !hasDisabled) {
panel.innerHTML = '<div class="alert alert-success" role="alert"><strong>Excellent!</strong> All checks passed.</div>';
return;
}
if (activeIssues === 0 && hasDisabled) {
panel.innerHTML = '<div class="alert alert-success" role="alert"><strong>All active checks passed.</strong> Re-enable disabled checks above to audit fully.</div>';
return;
}
panel.innerHTML = buildSummaryBar(checks);
const accordion = document.createElement('div');
accordion.className = 'accordion';
accordion.id        = 'resultsAccordion';
checks.forEach((check, index) => { accordion.innerHTML += buildAccordionItem({ ...check, index }); });
panel.appendChild(accordion);
}
