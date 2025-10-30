import { cleanupHtml } from './utils.js';

function normalizeNestedSups(doc) {
   const innerSups = doc.querySelectorAll('sup sup');
   const outermostParentsToReplace = new Set();

   innerSups.forEach(innerSup => {
       let outermostSup = innerSup;
       while (outermostSup.parentElement && outermostSup.parentElement.tagName === 'SUP') {
           outermostSup = outermostSup.parentElement;
       }
       if (/(®|&reg;)/i.test(outermostSup.textContent.trim())) {
           outermostParentsToReplace.add(outermostSup);
       }
   });

   if (outermostParentsToReplace.size > 0) {
       const cleanSup = doc.createElement('sup');
       cleanSup.style.lineHeight = '0';
       cleanSup.innerHTML = '&reg;';
       outermostParentsToReplace.forEach(badSupContainer => {
           badSupContainer.replaceWith(cleanSup.cloneNode(true));
       });
   }
}

function fixStrayTrademarks(doc) {
   const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
       acceptNode: (node) => (node.parentElement.tagName !== 'SUP') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
   });

   const nodesToProcess = [];
   while (walker.nextNode()) {
       if (/(®|&reg;)/i.test(walker.currentNode.nodeValue)) {
           nodesToProcess.push(walker.currentNode);
       }
   }

   nodesToProcess.forEach(textNode => {
       const parent = textNode.parentNode;
       if (!parent) return;

       const fragment = doc.createDocumentFragment();
       const parts = textNode.nodeValue.split(/(®|&reg;)/gi);

       parts.forEach(part => {
           if (/^®|&reg;$/i.test(part)) {
               const sup = doc.createElement('sup');
               sup.style.lineHeight = '0';
               sup.innerHTML = '&reg;';
               fragment.appendChild(sup);
           } else if (part) {
               fragment.appendChild(doc.createTextNode(part));
           }
       });
       parent.replaceChild(fragment, textNode);
   });
}

function fixRedHatSpacing(doc) {
   const incorrectSpacingRegex = /\bRed\s+Hat\b/gi;

   const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
   const nodesToProcess = [];
   while (walker.nextNode()) {
       if (incorrectSpacingRegex.test(walker.currentNode.nodeValue)) {
           nodesToProcess.push(walker.currentNode);
       }
       incorrectSpacingRegex.lastIndex = 0;
   }

   nodesToProcess.forEach(textNode => {
       const parent = textNode.parentNode;
       if (!parent) return;

       const fragment = doc.createDocumentFragment();
       const parts = textNode.nodeValue.split(incorrectSpacingRegex);
       const matches = textNode.nodeValue.match(incorrectSpacingRegex);

       parts.forEach((part, index) => {
           if (part) {
               fragment.appendChild(doc.createTextNode(part));
           }
           if (index < parts.length - 1) {
               const originalMatch = matches[index];
               const firstLetter = originalMatch.substring(0, 1);
               const lastLetter = originalMatch.substring(originalMatch.length - 1);
               const correctedText = `${firstLetter}ed\u00A0Ha${lastLetter}`;
               fragment.appendChild(doc.createTextNode(correctedText));
           }
       });
       parent.replaceChild(fragment, textNode);
   });
}

function collapseConsecutiveSups(doc) {
   const sups = doc.querySelectorAll('sup');
   sups.forEach(sup => {
       if (!sup.textContent.includes('®')) return;
       let nextNode = sup.nextSibling;
       while (nextNode && nextNode.nodeType === Node.TEXT_NODE && nextNode.textContent.trim() === '') {
           nextNode = nextNode.nextSibling;
       }
       if (nextNode && nextNode.tagName === 'SUP' && nextNode.textContent.includes('®')) {
           nextNode.remove();
           collapseConsecutiveSups(doc);
       }
   });
}

export function applyFixes(doc, auditResults) {
   auditResults.duplicate_attributes.forEach(item => {
       const { Element: tagName, Attribute: attrName } = item;
       const elementsToFix = doc.querySelectorAll(tagName);
       elementsToFix.forEach(element => {
           const finalValue = element.getAttribute(attrName);
           if (finalValue !== null) {
               element.removeAttribute(attrName);
               element.setAttribute(attrName, finalValue);
           }
       });
   });

   auditResults.insecure.forEach(link => {
       if (link.protocol === 'http:') link.href = link.href.replace(/^http:/, 'https');
   });
   auditResults.missingTargetBlank.forEach(link => link.setAttribute('target', '_blank'));
   auditResults.title_null_failures.forEach(item => item.element.removeAttribute('title'));
   auditResults.image_failures.forEach(item => {
       if (item.failures.includes("Missing border='0'")) item.element.setAttribute('border', '0');
       if (item.failures.includes("Missing/Empty alt")) item.element.setAttribute('alt', '');
   });
   auditResults.table_failures.forEach(item => {
       if (item.Reason.includes("border='0'")) item.element.setAttribute('border', '0');
       if (item.Reason.includes("role='presentation'")) item.element.setAttribute('role', 'presentation');
   });

   // --- ROBUST TRADEMARK REFACTORING (FOUR-PHASE) ---
   normalizeNestedSups(doc);
   auditResults.trademark_failures.forEach(item => {
       if (item.element && item.element.parentElement && item.element.tagName === 'SUP' && item.Reason.includes('incorrect line-height')) {
           item.element.style.lineHeight = '0';
       }
   });
   fixStrayTrademarks(doc);
   collapseConsecutiveSups(doc);

   fixRedHatSpacing(doc);

   cleanupHtml(doc);

   const doctype = doc.doctype ? new XMLSerializer().serializeToString(doc.doctype) + '\n' : '';
   let refactoredHtml = doctype + doc.documentElement.outerHTML;
   
   refactoredHtml = refactoredHtml.replace(/®/g, '&reg;');
   
   return refactoredHtml;
}