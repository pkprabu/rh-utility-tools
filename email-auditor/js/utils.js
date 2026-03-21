export function debounce(func, delay) {
let timeout;
return function (...args) {
clearTimeout(timeout);
timeout = setTimeout(() => func.apply(this, args), delay);
};
}
export function escapeHtml(unsafe) {
return String(unsafe)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#039;');
}
export function cleanupHtml(doc) {
doc.body.querySelectorAll('*').forEach((el) => {
for (const attr of el.attributes) {
let value = attr.value;
if (attr.name === 'style') {
value = value
.replace(/\s*:\s*/g, ':')
.replace(/\s*;\s*/g, ';');
}
const cleaned = value.replace(/\s+/g, ' ').trim();
if (attr.value !== cleaned) {
el.setAttribute(attr.name, cleaned);
}
}
});
const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
const preformattedTags = new Set(['PRE', 'SCRIPT', 'STYLE']);
const nodesToClean = [];
let node;
while ((node = walker.nextNode())) {
let ancestor = node.parentElement;
let inPreformatted = false;
while (ancestor) {
if (preformattedTags.has(ancestor.tagName)) {
inPreformatted = true;
break;
}
ancestor = ancestor.parentElement;
}
if (!inPreformatted) {
nodesToClean.push(node);
}
}
nodesToClean.forEach((n) => {
n.nodeValue = n.nodeValue.replace(/\s{2,}/g, ' ');
});
}
