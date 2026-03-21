import { config }                             from './config.js';
import { dom }                                from './dom.js';
import { debounce }                           from './utils.js';
import { run as runPreAudit }                 from './preAuditor.js';
import { runAudit as runPostAudit }           from './auditor.js';
import { applyFixes }                         from './refactorer.js';
import { renderResults, exportResultsPdf, getLastChecks } from './uiRenderer.js';
let lastResults  = null;
let lastAuditDoc = null;
let lastRawHtml  = '';
let lastRefactored = '';
let enabledChecks     = null;   // null = all enabled; Set of auditor keys otherwise
let disabledCheckKeys = new Set(); // UI check keys (matches buildChecks catalogue)
const ALL_CHECK_LABELS = {
structural_failures:      'HTML Structural Integrity (Error)',
malformed_html_failures:  'Malformed HTML Syntax (Error)',
javascript_detected:      'JavaScript Detected (Error)',
iframe_detected:          'Iframes Detected (Error)',
form_elements:            'Form Elements Detected (Error)',
insecure:                 'Insecure Links http:// (Error)',
sc_cid:                   'sc_cid Tracking Validation (Error)',
duplicate_attributes:     'Duplicate HTML Attributes (Error)',
duplicate_ids:            'Duplicate Element IDs (Error)',
nested_anchors:           'Nested Anchor Tags (Error)',
email_size_warning:       'Email File Size Warning (Error)',
image_failures:           'Image Policy Violations (Error)',
table_failures:           'Table Layout & Accessibility (Error)',
style_blocks:             'Style Blocks Detected / Inline CSS (Warning)',
video_audio_elements:     'Unsupported Media Elements (Warning)',
trademark_failures:       'Trademark Formatting (Error)',
nested_sup_failures:      'Nested Trademark Tags (Error)',
inaccessible:             "Inaccessible 'Empty' Links (Warning)",
empty_href:               'Empty href Attributes (Warning)',
missingTargetBlank:       'Links without target="_blank" (Warning)',
missingNoopener:          'Links missing rel="noopener" (Warning)',
link_color_failures:      'Invalid Link Color (Warning)',
title_null_failures:      'Links with title="null" (Warning)',
font_failures:            'Invalid Font Family (Warning)',
font_size_failures:       'Font Size Below Minimum (Warning)',
line_height_failures:     'Low Line Height (Warning)',
unsupported_css:          'Unsupported CSS Properties (Warning)',
css_important:            'CSS !important Usage (Warning)',
background_image:         'Invalid Background Image Source (Warning)',
broken_image_src:         'Broken/Placeholder Image src (Warning)',
spacer_images:            'Spacer Images Detected (Warning)',
relative_src_urls:        'Relative src= URLs (Warning)',
email_width_violations:   'Email Width Violations (Warning)',
redhat_spacing:           '"Red Hat" Spacing (Warning)',
dummy_text:               'Placeholder / Dummy Text (Warning)',
extra_space:              'Extra Whitespace (Warning)',
commented_code:           'Commented-Out Code (Warning)',
missing_lang:             'Missing lang Attribute (Info)',
missing_title:            'Missing <title> Tag (Info)',
missing_meta_charset:     'Missing <meta charset> (Info)',
missing_viewport_meta:    'Missing Viewport Meta Tag (Info)',
missing_preheader:        'Missing Preheader Text (Info)',
missing_unsubscribe:      'Missing Unsubscribe Link (Info)',
missing_physical_address: 'Missing Physical Address (Info)',
};
const ALL_AUDITOR_KEYS = [
'consecutive_trademarks','font_failures','background_image','extra_space','text_nodes',
'redhat_spacing','trademark_markup','image_failures','table_failures','duplicate_ids',
'nested_anchors','links','style_blocks','css_important','unsupported_css','font_size_failures',
'line_height_failures','missing_lang','missing_title','missing_preheader','email_width_violations',
'spacer_images','relative_src_urls','missing_meta_charset','missing_viewport_meta',
'missing_unsubscribe','missing_physical_address','broken_image_src','video_audio_elements',
'form_elements','javascript_detected','iframe_detected','commented_code','email_size_warning',
];
function isValidHex(value) {
return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}
function normaliseHex(hex) {
const h = hex.trim().toLowerCase();
if (h.length === 4) {
return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
}
return h;
}
function setLinkColorError(msg) {
const el = document.getElementById('link-color-error');
if (!el) return;
if (msg) {
el.textContent    = msg;
el.style.display  = 'block';
} else {
el.textContent    = '';
el.style.display  = 'none';
}
}
const STORAGE_SETTINGS = 'emailAuditor_settings_v1';
const DEFAULT_SETTINGS = {
checks: {},
minFontSize:         config.auditor.minFontSize,
minLineHeight:       config.auditor.minLineHeight,
maxEmailWidth:       config.auditor.maxEmailWidth,
requiredImagePrefix: config.auditor.requiredImagePrefix,
validFonts:          config.auditor.validFonts.join('\n'),
validLinkColors:     config.auditor.validLinkColors.join('\n'),
ignoreList:          config.auditor.ignoreList.join('\n'),
};
function loadSettings() {
try {
const raw = localStorage.getItem(STORAGE_SETTINGS);
if (!raw) return { ...DEFAULT_SETTINGS };
const stored = JSON.parse(raw);
const merged = { ...DEFAULT_SETTINGS, ...stored };
if (merged.validLinkColors) {
const lines   = merged.validLinkColors.split('\n').map((l) => l.trim()).filter(Boolean);
const hasStale = lines.some((l) => !isValidHex(l));
if (hasStale) {
merged.validLinkColors = DEFAULT_SETTINGS.validLinkColors;
try { localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(merged)); } catch {}
}
}
return merged;
} catch { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s) {
try { localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(s)); } catch {}
}
function applySettingsToConfig(settings) {
config.auditor.minFontSize         = Number(settings.minFontSize)   || DEFAULT_SETTINGS.minFontSize;
config.auditor.minLineHeight       = Number(settings.minLineHeight) || DEFAULT_SETTINGS.minLineHeight;
config.auditor.maxEmailWidth       = Number(settings.maxEmailWidth) || DEFAULT_SETTINGS.maxEmailWidth;
config.auditor.requiredImagePrefix = settings.requiredImagePrefix   || DEFAULT_SETTINGS.requiredImagePrefix;
config.auditor.validFonts          = settings.validFonts.split('\n').map((s) => s.trim()).filter(Boolean);
config.auditor.validLinkColors = settings.validLinkColors
.split('\n')
.map((s) => s.trim())
.filter(Boolean)
.filter(isValidHex)
.map(normaliseHex);
config.auditor.ignoreList          = settings.ignoreList.split('\n').map((s) => s.trim()).filter(Boolean);
const disabled = Object.entries(settings.checks || {}).filter(([, v]) => !v).map(([k]) => k);
enabledChecks = disabled.length === 0 ? null : new Set(ALL_AUDITOR_KEYS.filter((k) => !disabled.includes(k)));
disabledCheckKeys = new Set(disabled);
}
function initSettingsPanel() {
const settings = loadSettings();
applySettingsToConfig(settings);
const form = dom.settingsForm;
if (!form) return;
form.querySelector('#setting-min-font-size').value     = settings.minFontSize;
form.querySelector('#setting-min-line-height').value   = settings.minLineHeight;
form.querySelector('#setting-max-email-width').value   = settings.maxEmailWidth;
form.querySelector('#setting-required-prefix').value   = settings.requiredImagePrefix;
form.querySelector('#setting-valid-fonts').value       = settings.validFonts;
form.querySelector('#setting-valid-link-colors').value =
config.auditor.validLinkColors.join('\n');
form.querySelector('#setting-ignore-list').value       = settings.ignoreList;
const container = form.querySelector('#checks-toggles');
if (!container) return;
container.innerHTML = Object.entries(ALL_CHECK_LABELS).map(([key, label]) => {
const checked = settings.checks[key] !== false;
return `<div class="form-check form-switch mb-1">
<input class="form-check-input check-toggle" type="checkbox" id="chk-${key}" data-key="${key}" ${checked ? 'checked' : ''}>
<label class="form-check-label small" for="chk-${key}">${label}</label>
</div>`;
}).join('');
}
function readSettingsFromPanel() {
const form = dom.settingsForm;
if (!form) return loadSettings();
const s = { ...loadSettings() };
s.minFontSize         = form.querySelector('#setting-min-font-size').value;
s.minLineHeight       = form.querySelector('#setting-min-line-height').value;
s.maxEmailWidth       = form.querySelector('#setting-max-email-width').value;
s.requiredImagePrefix = form.querySelector('#setting-required-prefix').value;
s.validFonts          = form.querySelector('#setting-valid-fonts').value;
const rawColors   = form.querySelector('#setting-valid-link-colors').value;
const colorLines  = rawColors.split('\n').map((l) => l.trim()).filter(Boolean);
const invalidLines = colorLines.filter((l) => !isValidHex(l));
if (invalidLines.length > 0) {
setLinkColorError(
`Invalid colour value${invalidLines.length > 1 ? 's' : ''}: ` +
invalidLines.map((l) => `"${l}"`).join(', ') +
'. Only HEX format is accepted (e.g. #EE0000 or #E00).'
);
} else {
setLinkColorError('');
}
s.validLinkColors = rawColors;
s.ignoreList          = form.querySelector('#setting-ignore-list').value;
s.checks = {};
form.querySelectorAll('.check-toggle').forEach((cb) => { s.checks[cb.dataset.key] = cb.checked; });
return s;
}
function isBodyOnly() { return dom.modeBodyRadio.checked; }
function looksLikeFullDocument(html) {
return /<!doctype\s/i.test(html) || /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html);
}
function extractBodyContent(html) {
if (!looksLikeFullDocument(html)) return html;
const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
return match ? match[1] : html;
}
function wrapFragment(fragment) {
return `<!DOCTYPE html><html><head></head><body>${extractBodyContent(fragment)}</body></html>`;
}
function syncLabel() {
dom.htmlInputLabel.textContent = isBodyOnly() ? 'Paste Email Body HTML Code' : 'Paste Full Email HTML Code';
}
function syncInputStates() {
const scCidValue    = dom.scCidInput.value.trim();
const htmlContent   = dom.htmlInput.value.trim();
const shouldDisable = !scCidValue;
if (dom.htmlInput.disabled !== shouldDisable) {
dom.htmlInput.disabled    = shouldDisable;
dom.uploadButton.disabled = shouldDisable;
if (shouldDisable) {
dom.htmlInput.value       = '';
dom.htmlInput.placeholder = "Please provide a 'sc_cid' value above to enable this field.";
lastResults = null;
renderResults(null, null, false, disabledCheckKeys);
} else {
dom.htmlInput.placeholder = isBodyOnly()
? "Paste your email's body HTML here\u2026 the audit will run automatically."
: "Paste your email's HTML code here\u2026 the audit will run automatically.";
}
}
dom.uploadButton.disabled = shouldDisable;
const hasIssues = lastResults && Object.values(lastResults).some((arr) => arr.length > 0);
dom.refactorButton.disabled = !scCidValue || !htmlContent || !hasIssues;
}
const ALLOWED_EXTENSIONS = new Set(['.html', '.htm']);
function setUploadError(msg) {
if (msg) { dom.uploadError.textContent = msg; dom.uploadError.style.display = 'block'; }
else      { dom.uploadError.textContent = ''; dom.uploadError.style.display = 'none'; }
}
function loadFile(file) {
const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';
if (!ALLOWED_EXTENSIONS.has(ext)) { setUploadError(`Invalid file type "${file.name}". Please upload an .html or .htm file.`); return; }
setUploadError('');
const reader = new FileReader();
reader.onload  = (e) => { dom.htmlInput.value = e.target.result; debouncedAudit(); };
reader.onerror = () => setUploadError('Could not read the file. Please try again.');
reader.readAsText(file);
}
function loadSandbox(htmlContent, bodyOnly) {
return new Promise((resolve) => {
const sandboxDoc = dom.sandboxFrame.contentWindow.document;
const toLoad     = bodyOnly ? wrapFragment(htmlContent) : htmlContent;
sandboxDoc.open();
sandboxDoc.write(toLoad);
sandboxDoc.close();
const adaptiveMs = Math.min(100 + Math.floor(htmlContent.length / 4000), 600);
setTimeout(() => resolve(sandboxDoc), adaptiveMs);
});
}
const LARGE_FILE_THRESHOLD = 200_000;
async function runAuditPipeline() {
syncInputStates();
const htmlContent = dom.htmlInput.value;
const scCidValue  = dom.scCidInput.value.trim();
const bodyOnly    = isBodyOnly();
dom.auditSpinner.classList.remove('d-none');
if (!htmlContent.trim()) {
lastResults = null; lastRawHtml = '';
renderResults(null, null, false, disabledCheckKeys);
dom.auditSpinner.classList.add('d-none');
syncInputStates(); return;
}
await new Promise((r) => setTimeout(r, 0));
const byteLen = new TextEncoder().encode(htmlContent).length;
if (byteLen > LARGE_FILE_THRESHOLD) {
const kb = (byteLen / 1024).toFixed(0);
dom.resultsPanel.innerHTML = `
<div class="alert alert-secondary d-flex align-items-center gap-3" role="status">
<span class="spinner-border spinner-border-sm flex-shrink-0 text-secondary"
aria-hidden="true"></span>
<span>
<strong>Auditing large file (${kb} KB)</strong> &mdash;
this may take a few seconds. Please wait&hellip;
</span>
</div>`;
await new Promise((r) => setTimeout(r, 0));
}
lastRawHtml = htmlContent;
const preResults = runPreAudit(htmlContent);
try {
const sandboxDoc  = await loadSandbox(htmlContent, bodyOnly);
const postResults = runPostAudit(sandboxDoc, dom.sandboxFrame.contentWindow, scCidValue, htmlContent, enabledChecks);
lastResults  = { ...preResults, ...postResults };
lastAuditDoc = sandboxDoc;
renderResults(lastResults, scCidValue, true, disabledCheckKeys);
attachResultsHandlers();
if (previewVisible) refreshPreview();
} catch (err) {
console.error('Error during audit:', err);
dom.resultsPanel.innerHTML = `<div class="alert alert-danger" role="alert"><strong>An error occurred during the audit.</strong><br>Check the browser console for details.</div>`;
} finally {
dom.auditSpinner.classList.add('d-none');
syncInputStates();
}
}
const debouncedAudit = debounce(runAuditPipeline, 500);
function attachResultsHandlers() {
dom.resultsPanel.querySelectorAll('tr[data-element-ref]').forEach((row) => {
row.addEventListener('click', () => {
const collapseId = row.closest('.accordion-collapse')?.id;
if (!collapseId) return;
const index = parseInt(collapseId.replace('collapse', ''), 10);
const checks = getLastChecks();
if (!checks[index]?.elementRefs) return;
const el = checks[index].elementRefs[parseInt(row.dataset.elementRef, 10)];
if (el) highlightElement(el);
});
});
const exportBtn = document.getElementById('export-pdf-btn');
if (exportBtn) {
exportBtn.addEventListener('click', () => {
exportResultsPdf(getLastChecks(), dom.scCidInput.value.trim());
});
}
}
function highlightElement(el) {
if (!el || !el.style) return;
if (!previewVisible) togglePreview();
const prev = el.style.outline;
el.style.outline = '3px solid #ee0000';
el.scrollIntoView({ behavior: 'smooth', block: 'center' });
setTimeout(() => { el.style.outline = prev || ''; }, 2500);
}
async function runRefactorPipeline() {
if (!lastResults || !lastAuditDoc) return;
const spinner    = dom.refactorButton.querySelector('.spinner-border');
const buttonText = dom.refactorButton.querySelector('.button-text');
spinner.classList.remove('d-none'); buttonText.classList.add('d-none'); dom.refactorButton.disabled = true;
await new Promise((resolve) => setTimeout(resolve, 50));
try {
const scCidValue = dom.scCidInput.value.trim();
lastRefactored   = applyFixes(lastAuditDoc, lastResults, scCidValue, isBodyOnly());
dom.refactoredCodeTextarea.value = lastRefactored;
renderDiff(lastRawHtml, lastRefactored);
dom.refactorModal.show();
} catch (err) {
console.error('Error during refactoring:', err);
alert('An error occurred while refactoring. Please check the console for details.');
} finally {
spinner.classList.add('d-none'); buttonText.classList.remove('d-none');
syncInputStates();
}
}
function escLine(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function computeLineDiff(original, refactored) {
const origSet = new Set(original.split('\n'));
const refLines = refactored.split('\n');
const origLines = original.split('\n');
const refSet  = new Set(refLines);
const added   = refLines.filter((l) => !origSet.has(l)).map((l) => `<ins class="diff-ins">${escLine(l)}</ins>`);
const removed = origLines.filter((l) => !refSet.has(l)).map((l) => `<del class="diff-del">${escLine(l)}</del>`);
return [...added, ...removed].join('\n') || '<span class="text-secondary">No differences detected.</span>';
}
function renderDiff(original, refactored) {
if (!dom.diffPanel) return;
dom.diffPanel.innerHTML = `<pre class="diff-output p-2" style="max-height:400px;overflow:auto;font-size:0.78rem;">${computeLineDiff(original, refactored)}</pre>`;
}
let previewVisible = false;
let previewIframe  = null;
function refreshPreview() {
if (!previewIframe || !lastRawHtml) return;
const bodyOnly = isBodyOnly();
const html     = bodyOnly ? wrapFragment(lastRawHtml) : lastRawHtml;
try {
const doc = previewIframe.contentWindow.document;
doc.open(); doc.write(html); doc.close();
} catch (e) {
console.warn('Preview write failed:', e);
}
}
function togglePreview() {
previewVisible = !previewVisible;
dom.previewToggleBtn.textContent = previewVisible ? 'Hide Preview' : 'Show Preview';
if (previewVisible) {
if (!previewIframe) {
previewIframe = document.createElement('iframe');
previewIframe.style.cssText = 'width:100%;height:520px;border:1px solid var(--bs-border-color);border-radius:4px;background:#fff;';
previewIframe.setAttribute('title', 'Email preview');
dom.previewPane.appendChild(previewIframe);
}
dom.previewPane.classList.remove('d-none');
if (lastRawHtml) {
refreshPreview();
} else if (lastAuditDoc) {
const doctype = lastAuditDoc.doctype ? new XMLSerializer().serializeToString(lastAuditDoc.doctype) + '\n' : '';
const html    = doctype + lastAuditDoc.documentElement.outerHTML;
try {
const doc = previewIframe.contentWindow.document;
doc.open(); doc.write(html); doc.close();
} catch {}
}
} else {
dom.previewPane.classList.add('d-none');
}
}
function initTheme() {
try {
const saved = localStorage.getItem('emailAuditor_theme');
if (saved) document.documentElement.setAttribute('data-bs-theme', saved);
} catch {}
updateThemeBtn();
}
function toggleTheme() {
const current = document.documentElement.getAttribute('data-bs-theme') || 'dark';
const next    = current === 'dark' ? 'light' : 'dark';
document.documentElement.setAttribute('data-bs-theme', next);
try { localStorage.setItem('emailAuditor_theme', next); } catch {}
updateThemeBtn();
}
function updateThemeBtn() {
const current = document.documentElement.getAttribute('data-bs-theme') || 'dark';
if (dom.themeToggleBtn) dom.themeToggleBtn.textContent = current === 'dark' ? 'Light Mode' : 'Dark Mode';
}
function copyRefactoredCode() {
dom.refactoredCodeTextarea.select();
document.execCommand('copy');
dom.copyCodeButton.textContent = 'Copied!';
setTimeout(() => { dom.copyCodeButton.textContent = 'Copy Code'; }, 2000);
}
function suppressDragDefault(e) { e.preventDefault(); }
function clearDragState() {
dom.htmlInput.classList.remove('drag-over');
if (dom.htmlInputWrapper) dom.htmlInputWrapper.classList.remove('drag-active');
}
function onDragEnter(e) {
suppressDragDefault(e);
if (dom.htmlInput.disabled) return;
dom.htmlInput.classList.add('drag-over');
if (dom.htmlInputWrapper) dom.htmlInputWrapper.classList.add('drag-active');
}
function onDragOver(e) {
suppressDragDefault(e);
if (!dom.htmlInput.disabled) e.dataTransfer.dropEffect = 'copy';
}
function onDragLeave(e) {
suppressDragDefault(e);
const wrapper = dom.htmlInputWrapper || dom.htmlInput;
if (!wrapper.contains(e.relatedTarget)) {
clearDragState();
}
}
function onDrop(e) {
suppressDragDefault(e);
clearDragState();
if (dom.htmlInput.disabled) return;
const files = e.dataTransfer.files;
if (files && files.length > 0) loadFile(files[0]);
}
function onModeChange() {
syncLabel(); syncInputStates();
if (dom.htmlInput.value.trim() && dom.scCidInput.value.trim()) debouncedAudit();
}
dom.scCidInput.addEventListener('input', debouncedAudit);
dom.htmlInput.addEventListener('input',  debouncedAudit);
dom.refactorButton.addEventListener('click', runRefactorPipeline);
dom.copyCodeButton.addEventListener('click', copyRefactoredCode);
dom.uploadButton.addEventListener('click', () => dom.fileInput.click());
dom.fileInput.addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadFile(f); dom.fileInput.value = ''; });
if (dom.htmlInputWrapper) {
dom.htmlInputWrapper.addEventListener('dragenter', onDragEnter);
dom.htmlInputWrapper.addEventListener('dragover',  onDragOver);
dom.htmlInputWrapper.addEventListener('dragleave', onDragLeave);
dom.htmlInputWrapper.addEventListener('drop',      onDrop);
}
document.addEventListener('dragover',  (e) => e.preventDefault());
document.addEventListener('drop',      (e) => e.preventDefault());
dom.modeFullRadio.addEventListener('change', onModeChange);
dom.modeBodyRadio.addEventListener('change', onModeChange);
if (dom.previewToggleBtn) dom.previewToggleBtn.addEventListener('click', togglePreview);
if (dom.themeToggleBtn)   dom.themeToggleBtn.addEventListener('click', toggleTheme);
if (dom.settingsBtn) dom.settingsBtn.addEventListener('click', () => dom.settingsOffcanvas.show());
if (dom.settingsForm) {
dom.settingsForm.addEventListener('change', () => {
const s = readSettingsFromPanel();
saveSettings(s);
applySettingsToConfig(s);
const colorError = document.getElementById('link-color-error');
const colorsAreValid = !colorError || colorError.style.display === 'none';
if (colorsAreValid && dom.htmlInput.value.trim() && dom.scCidInput.value.trim()) {
debouncedAudit();
}
});
}
if (dom.settingsResetBtn) {
dom.settingsResetBtn.addEventListener('click', () => {
try { localStorage.removeItem(STORAGE_SETTINGS); } catch {}
initSettingsPanel();
applySettingsToConfig(loadSettings());
if (dom.htmlInput.value.trim()) debouncedAudit();
});
}
document.addEventListener('DOMContentLoaded', () => {
initTheme();
initSettingsPanel();
syncLabel();
syncInputStates();
});
