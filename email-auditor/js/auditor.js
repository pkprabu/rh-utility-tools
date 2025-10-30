import { config } from './config.js';

export function runAudit(doc, sandboxWindow, scCidValue) {
   const auditConfig = config.auditor;
   const { requiredImagePrefix, validFonts, validLinkColors, ignoreList, dummyKeywords } = auditConfig;
   const { parameterName } = config;
   
   let checkSpecificValue = !!scCidValue;
   const exclusionSet = new Set();
   const viewOnlineEl = doc.body.querySelector('#view-online');
   if (viewOnlineEl) exclusionSet.add(viewOnlineEl);
   const mainTables = doc.body.querySelectorAll('.mktoModule.em_main_table');
   if (mainTables.length > 0) exclusionSet.add(mainTables[mainTables.length - 1]);
   const allMktoModules = doc.body.querySelectorAll('.mktoModule');
   if (allMktoModules.length > 0) {
       if (allMktoModules[0]) exclusionSet.add(allMktoModules[0]);
       if (allMktoModules.length > 1) exclusionSet.add(allMktoModules[allMktoModules.length - 1]);
   }
   const excludedContainers = Array.from(exclusionSet);

   const results = {
       insecure: [], missingTargetBlank: [], sc_cid_malformed: [], sc_cid_missing: [], sc_cid_empty: [],
       sc_cid_duplicate: [], sc_cid_wrong_value: [], inaccessible: [], redhat_spacing: [], dummy_text: [],
       image_failures: [], table_failures: [], font_failures: [], link_color_failures: [], trademark_failures: [],
       title_null_failures: [], background_image_failures: [], extra_space_text: [], extra_space_attributes: [],
       duplicate_attributes: [],
       consecutive_trademarks: []
   };
   
   function isElementExcluded(element) {
       if (!element || excludedContainers.length === 0) return false;
       return excludedContainers.some(container => container === element || container.contains(element));
   }
   function getContextSnippets(text, regex, wordsBefore, wordsAfter) {
       const snippets = []; let match;
       const localRegex = new RegExp(regex.source, 'gi');
       while ((match = localRegex.exec(text)) !== null) {
           const textBefore = text.substring(0, match.index);
           const textAfter = text.substring(match.index + match[0].length);
           const wordsInTextBefore = textBefore.trim().split(/\s+/);
           const wordsInTextAfter = textAfter.trim().split(/\s+/);
           const contextBefore = wordsInTextBefore.slice(-wordsBefore).join(' ');
           const contextAfter = wordsInTextAfter.slice(0, wordsAfter).join(' ');
           const snippet = `...${contextBefore} **${match[0].replace(/\s/g, '·')}** ${contextAfter}...`;
           snippets.push(snippet);
       }
       return snippets;
   }

   const consecutiveRegex = /®\s*®/;
   const auditedConsecutiveElements = new Set();

   doc.body.querySelectorAll('*').forEach(el => {
       if (isElementExcluded(el)) return;

       if (consecutiveRegex.test(el.textContent)) {
           let parentInSet = false;
           let parent = el.parentElement;
           while(parent) {
               if (auditedConsecutiveElements.has(parent)) {
                   parentInSet = true;
                   break;
               }
               parent = parent.parentElement;
           }
           if (!parentInSet) {
               results.consecutive_trademarks.push({
                   "Element": el.tagName,
                   "Text Content": el.textContent.trim().substring(0, 100) + '...',
                   element: el
               });
               auditedConsecutiveElements.add(el);
           }
       }

       const style = sandboxWindow.getComputedStyle(el);
       if (el.offsetParent !== null && el.children.length === 0 && el.innerText.trim() !== '') {
           const firstFontInStack = style.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
           if (!validFonts.includes(firstFontInStack)) results.font_failures.push({ "Element": el.tagName, "Text": el.innerText.trim().substring(0, 50) + '...', "Invalid Font Stack": style.fontFamily });
       }
       const bgImage = style.backgroundImage;
       if (bgImage && bgImage !== 'none') {
           const urlMatch = bgImage.match(/url\("?(.+?)"?\)/);
           if (urlMatch && urlMatch[1]) {
               try {
                   const resolvedUrl = new URL(urlMatch[1], sandboxWindow.location.origin);
                   if (!resolvedUrl.href.startsWith(requiredImagePrefix)) results.background_image_failures.push({ "Reason": `Source not from ${requiredImagePrefix}`, "Invalid URL": urlMatch[1], "Element": `${el.tagName} (id: ${el.id || 'none'})` });
               } catch (e) { console.warn('Could not parse background-image URL:', urlMatch[1]); }
           }
       }

       for (const attr of el.attributes) {
           if (/\s{2,}/.test(attr.value) || attr.value.trim() !== attr.value) {
               results.extra_space_attributes.push({ "Element": el.tagName, "Attribute": attr.name, "Problematic Value": `"${attr.value}"` });
           }
       }
   });
   
   const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
   const spacingErrorRegex = /\bRed(?!\u00A0)\s+Hat\b/gi;
   const dummyTextRegex = new RegExp('\\b(' + dummyKeywords.join('|') + ')\\b', 'gi');
   const rawTrademarkRegex = /®/g;
   const extraSpaceRegex = /\s{2,}/g;
   let currentNode;
   while (currentNode = walker.nextNode()) {
       if (isElementExcluded(currentNode.parentElement)) continue;
       const nodeText = currentNode.nodeValue;

       if (rawTrademarkRegex.test(nodeText)) {
           const parent = currentNode.parentElement;
           const isInsideCorrectSup = parent && parent.tagName === 'SUP' && parent.style.lineHeight === '0';
           if (!isInsideCorrectSup) {
               results.trademark_failures.push({ 
                   "Reason": "Raw ® character found outside a correctly styled <sup>", 
                   "Snippet": getContextSnippets(nodeText, rawTrademarkRegex, 4, 4).join(' | '), 
                   element: parent 
               });
           }
       }
       rawTrademarkRegex.lastIndex = 0;

       if (spacingErrorRegex.test(nodeText)) {
           results.redhat_spacing.push({ snippet: getContextSnippets(nodeText, spacingErrorRegex, 4, 4).join(' | '), element: currentNode.parentElement });
       }
       spacingErrorRegex.lastIndex = 0;

       if (dummyTextRegex.test(nodeText)) results.dummy_text.push({ snippet: getContextSnippets(nodeText, dummyTextRegex, 4, 4).join(' | '), element: currentNode.parentElement });
       if (extraSpaceRegex.test(nodeText)) results.extra_space_text.push({ "Reason": "Multiple whitespace characters found in text", "Snippet": getContextSnippets(nodeText, extraSpaceRegex, 4, 4).join(' | '), element: currentNode.parentElement });
   }
   
   doc.body.querySelectorAll('*:not(script):not(style):not(sup)').forEach(el => {
       if (isElementExcluded(el) || el.children.length !== 0) return;
       if (el.innerHTML.includes('&reg;')) {
           results.trademark_failures.push({ "Reason": "&reg; entity found outside of a <sup> tag", "Snippet": el.outerHTML, element: el });
       }
   });

   doc.body.querySelectorAll('sup').forEach(sup => {
       if (isElementExcluded(sup)) return;
       if (sup.textContent.includes('®') && sup.style.lineHeight !== '0') {
           results.trademark_failures.push({ 
               "Reason": `<sup> with &reg; is missing the inline 'style=\"line-height: 0;\"'`, 
               "Snippet": sup.outerHTML, 
               element: sup 
           });
       }
   });

   doc.body.querySelectorAll('img').forEach(image => {
       if (isElementExcluded(image)) return;
       const failures = [];
       const src = image.getAttribute('src');
       if (!src || src.trim() === '') failures.push("Missing/Empty src");
       else if (!image.src.startsWith(requiredImagePrefix) && !image.src.startsWith('http://220-nsz-364.mktoweb.com')) failures.push(`Source not from ${requiredImagePrefix}`);
       if (image.getAttribute('alt') === null) failures.push("Missing/Empty alt");
       if (!image.getAttribute('width') || !image.getAttribute('height')) failures.push("Missing width/height attributes");
       if (image.getAttribute('border') !== '0') failures.push("Missing border='0'");
       if (failures.length > 0) results.image_failures.push({ "Failure Reasons": failures.join(', '), "Image Source": src || "[Not Found]", "Alt Text": image.alt === null ? "[Missing]" : image.alt, element: image, failures: failures });
   });
   doc.body.querySelectorAll('table').forEach(table => {
       if (isElementExcluded(table)) return;
       if (table.getAttribute('border') !== '0') results.table_failures.push({ "Reason": "Missing border='0'", "Table ID": table.id || "[no id]", "Table Class": table.className || "[no class]", element: table });
       if (table.getAttribute('role') !== 'presentation') results.table_failures.push({ "Reason": "Missing role='presentation' for accessibility", "Table ID": table.id || "[no id]", "Table Class": table.className || "[no class]", element: table });
   });
   doc.body.querySelectorAll('a').forEach(link => {
       if (isElementExcluded(link)) return;
       const href = link.getAttribute('href'); if (!href) return;
       if (link.getAttribute('title') === 'null') results.title_null_failures.push({ "Link Text": link.innerText.trim(), "Link URL": href, element: link });
       if (!link.innerText.trim() && !(link.getAttribute('aria-label') || '').trim() && !Array.from(link.querySelectorAll('img')).some(img => (img.getAttribute('alt') || '').trim() !== '')) results.inaccessible.push(link);
       if (ignoreList.some(p => link.href.startsWith(p)) || href.startsWith('#') || ['mailto:', 'tel:', 'javascript:'].some(p => href.startsWith(p))) return;
       if (!validLinkColors.includes(sandboxWindow.getComputedStyle(link).color)) results.link_color_failures.push({ "Link Text": link.innerText.trim(), "Invalid Color": sandboxWindow.getComputedStyle(link).color });
       if (link.protocol === 'http:') results.insecure.push(link);
       if (link.target !== '_blank') results.missingTargetBlank.push(link);
       const paramString = `${parameterName}=`;
       if (link.href.includes(paramString) && !link.search.includes(paramString)) { results.sc_cid_malformed.push(link); return; }
       const occurrences = (link.search.match(new RegExp(`[?&]${parameterName}`, 'g')) || []).length;
       if (occurrences === 0) { results.sc_cid_missing.push(link); } else {
           if (occurrences > 1) results.sc_cid_duplicate.push(link);
           if (new RegExp(`[?&]${parameterName}(&|$)`).test(link.search)) results.sc_cid_empty.push(link);
           if (checkSpecificValue) {
               try {
                   if (new URL(link.href).searchParams.get(parameterName) !== scCidValue) results.sc_cid_wrong_value.push(link);
               } catch (e) {}
           }
       }
   });
   return results;
}