import { config }      from './config.js';
import { cleanupHtml } from './utils.js';
function fixDuplicateAttributes(duplicateItems) {
duplicateItems.forEach(({ element, Attribute: attrName }) => {
if (!element) return;
const value = element.getAttribute(attrName);
if (value !== null) { element.removeAttribute(attrName); element.setAttribute(attrName, value); }
});
}
function fixInsecureLinks(insecureLinks) {
insecureLinks.forEach((link) => { if (link.protocol === 'http:') link.protocol = 'https:'; });
}
function fixMissingTargetBlank(links) {
links.forEach((link) => link.setAttribute('target', '_blank'));
}
function fixMissingNoopener(links) {
links.forEach((link) => {
const parts = ((link.getAttribute('rel') || '').trim() || '').split(/\s+/).filter(Boolean);
if (!parts.includes('noopener'))   parts.push('noopener');
if (!parts.includes('noreferrer')) parts.push('noreferrer');
link.setAttribute('rel', parts.join(' '));
});
}
function fixTitleNull(items) {
items.forEach(({ element }) => element.removeAttribute('title'));
}
function fixImageLinkDecoration(doc) {
doc.querySelectorAll('a').forEach((link) => { if (link.querySelector('img')) link.style.textDecoration = 'none'; });
}
function fixImages(doc, imageItems) {
const LARGE = 200;
const flaggedMap = new Map(imageItems.map((item) => [item.element, item]));
doc.body.querySelectorAll('img').forEach((img) => {
img.style.display = 'block'; img.style.border = '0';
img.style.outline = 'none'; img.style.textDecoration = 'none'; img.style.height = 'auto';
const rw = img.width;
if (rw > LARGE) { img.style.width = '100%'; img.style.maxWidth = `${rw}px`; }
const item = flaggedMap.get(img);
if (!item) return;
img.setAttribute('border', '0');
if (item.failures.includes('Missing alt attribute')) img.setAttribute('alt', '');
const rh = img.height;
if (rw > 0 && !img.getAttribute('width'))  img.setAttribute('width',  rw);
if (rh > 0 && !img.getAttribute('height')) img.setAttribute('height', rh);
});
}
function fixTables(tableItems) {
tableItems.forEach(({ element, Reason }) => {
if (Reason.includes("border='0'"))          element.setAttribute('border', '0');
if (Reason.includes("role='presentation'")) element.setAttribute('role',   'presentation');
});
}
function updateScCid(doc, newScCidValue) {
if (!newScCidValue) return;
const { ignoreList } = config.auditor;
const parameterName  = config.parameterName;
doc.querySelectorAll('a[href]').forEach((link) => {
const href = link.getAttribute('href');
if (!href) return;
const isSpecial = href.startsWith('#') || ['mailto:', 'tel:', 'javascript:'].some((p) => href.startsWith(p));
const isIgnored = ignoreList.some((prefix) => link.href.startsWith(prefix));
if (isSpecial || isIgnored) return;
try {
const url = new URL(link.href);
url.searchParams.delete(parameterName);
url.searchParams.set(parameterName, newScCidValue);
link.setAttribute('href', url.href);
} catch { console.warn('Could not parse and update URL:', href); }
});
}
function normalizeNestedSups(doc) {
const toReplace = new Set();
doc.querySelectorAll('sup sup').forEach((inner) => {
let outermost = inner;
while (outermost.parentElement?.tagName === 'SUP') outermost = outermost.parentElement;
if (/(®|&reg;)/i.test(outermost.textContent.trim())) toReplace.add(outermost);
});
if (toReplace.size === 0) return;
const cleanSup = doc.createElement('sup');
cleanSup.style.lineHeight = '0'; cleanSup.innerHTML = '&reg;';
toReplace.forEach((bad) => bad.replaceWith(cleanSup.cloneNode(true)));
}
function fixStrayTrademarks(doc) {
const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
acceptNode: (node) => node.parentElement.tagName !== 'SUP' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
});
const nodesToProcess = [];
while (walker.nextNode()) { if (/®/g.test(walker.currentNode.nodeValue)) nodesToProcess.push(walker.currentNode); }
nodesToProcess.forEach((textNode) => {
const parent = textNode.parentNode; if (!parent) return;
const fragment = doc.createDocumentFragment();
textNode.nodeValue.split(/(®)/g).forEach((part) => {
if (part === '®') { const sup = doc.createElement('sup'); sup.style.lineHeight = '0'; sup.innerHTML = '&reg;'; fragment.appendChild(sup); }
else if (part) fragment.appendChild(doc.createTextNode(part));
});
parent.replaceChild(fragment, textNode);
});
}
function fixSupLineHeight(doc) {
doc.body.querySelectorAll('sup').forEach((sup) => {
if (sup.textContent.includes('®') && sup.style.lineHeight !== '0') sup.style.lineHeight = '0';
});
}
function fixRedHatSpacing(doc) {
const incorrectRegex = /\b(Red\s+Hat|RedHat)\b/gi;
const correctSpacing = 'Red\u00A0Hat';
const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
const nodes = [];
let node;
while ((node = walker.nextNode())) { if (incorrectRegex.test(node.nodeValue)) nodes.push(node); incorrectRegex.lastIndex = 0; }
nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(incorrectRegex, correctSpacing); });
}
function collapseConsecutiveSups(doc) {
let changed = true;
while (changed) {
changed = false;
doc.querySelectorAll('sup').forEach((sup) => {
if (!sup.textContent.includes('®')) return;
let next = sup.nextSibling;
while (next?.nodeType === Node.TEXT_NODE && next.textContent.trim() === '') next = next.nextSibling;
if (next?.tagName === 'SUP' && next.textContent.includes('®')) { next.remove(); changed = true; }
});
}
}
export function applyFixes(doc, auditResults, newScCidValue, bodyOnly = false) {
fixDuplicateAttributes(auditResults.duplicate_attributes);
fixInsecureLinks(auditResults.insecure);
fixMissingTargetBlank(auditResults.missingTargetBlank);
fixMissingNoopener(auditResults.missingNoopener || []);
fixTitleNull(auditResults.title_null_failures);
fixImageLinkDecoration(doc);
fixImages(doc, auditResults.image_failures);
fixTables(auditResults.table_failures);
updateScCid(doc, newScCidValue);
normalizeNestedSups(doc);
fixSupLineHeight(doc);
fixStrayTrademarks(doc);
collapseConsecutiveSups(doc);
fixRedHatSpacing(doc);
cleanupHtml(doc);
if (bodyOnly) {
return doc.body.innerHTML.replace(/®/g, '&reg;');
}
const doctype = doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) + '\n' : '';
let html = doctype + doc.documentElement.outerHTML;
return html.replace(/®/g, '&reg;');
}
