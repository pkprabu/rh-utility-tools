export const debounce = (func, delay) => {
let timeout;
return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
};
};

export const escapeHtml = (unsafe) => {
return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

export const cleanupHtml = (doc) => {
doc.body.querySelectorAll('*').forEach(el => {
    for (const attr of el.attributes) {
        let value = attr.value;
        if (attr.name === 'style') {
            value = value.replace(/\s*:\s*/g, ':').replace(/\s*;\s*/g, ';');
        }
        const cleanedValue = value.replace(/\s+/g, ' ').trim();
        if (attr.value !== cleanedValue) {
            el.setAttribute(attr.name, cleanedValue);
        }
    }
});
const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
let node;
const nodesToClean = [];
while (node = walker.nextNode()) {
    let parent = node.parentElement;
    let inPreformatted = false;
    while (parent) {
        if (['PRE', 'SCRIPT', 'STYLE'].includes(parent.tagName)) {
            inPreformatted = true;
            break;
        }
        parent = parent.parentElement;
    }
    if (!inPreformatted) nodesToClean.push(node);
}
nodesToClean.forEach(node => {
    node.nodeValue = node.nodeValue.replace(/\s{2,}/g, ' ');
});
};