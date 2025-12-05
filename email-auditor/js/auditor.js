import { config } from './config.js';

export function runAudit(doc, sandboxWindow, scCidValue) {
 const auditConfig = config.auditor;
 const { requiredImagePrefix, validFonts, validLinkColors, ignoreList, dummyKeywords, brandTextRules } = auditConfig;
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
     insecure: [],
     missingTargetBlank: [],
     sc_cid_malformed: [],
     sc_cid_missing: [],
     sc_cid_empty: [],
     sc_cid_duplicate: [],
     sc_cid_wrong_value: [],
     inaccessible: [],
     redhat_spacing: [],
     dummy_text: [],
     image_failures: [],
     table_failures: [],
     font_failures: [],
     link_color_failures: [],
     trademark_failures: [],
     title_null_failures: [],
     background_image_failures: [],
     extra_space_text: [],
     extra_space_attributes: [],
     duplicate_attributes: [],
     consecutive_trademarks: [],
     linked_image_failures: []
 };

 function isElementExcluded(element) {
     if (!element || excludedContainers.length === 0) return false;
     return excludedContainers.some(container => container === element || container.contains(element));
 }

 doc.body.querySelectorAll('sup').forEach(sup => {
     if (isElementExcluded(sup)) return;
     if (sup.textContent.includes('®') && sup.style.lineHeight !== '0') {
         results.trademark_failures.push({
             "Reason": "The `<sup>` tag for `®` is missing the required `style=\"line-height: 0;\"`.",
             "Snippet": sup.outerHTML,
             element: sup
         });
     }
 });

 const nestedSups = doc.body.querySelectorAll('sup sup');
 const outermostNestedSups = new Set();
 nestedSups.forEach(innerSup => {
     let outermostSup = innerSup;
     while (outermostSup.parentElement && outermostSup.parentElement.tagName === 'SUP') {
         outermostSup = outermostSup.parentElement;
     }
     if (/(®|&reg;)/i.test(outermostSup.textContent.trim())) {
         outermostNestedSups.add(outermostSup);
     }
 });

 outermostNestedSups.forEach(supElement => {
     results.trademark_failures.push({
         "Reason": "Incorrectly nested <sup> tags for a trademark symbol found.",
         "Snippet": supElement.outerHTML,
         element: supElement
     });
 });

 doc.body.querySelectorAll('img').forEach(image => {
     if (isElementExcluded(image)) return;
     const failures = [];
     const style = sandboxWindow.getComputedStyle(image);
     const src = image.getAttribute('src');

     if (!src || src.trim() === '') failures.push("Missing/Empty src");
     else if (!image.src.startsWith(requiredImagePrefix) && !image.src.startsWith('http://220-nsz-364.mktoweb.com')) failures.push(`Source not from ${requiredImagePrefix}`);
     
     if (image.getAttribute('alt') === null) failures.push("Missing/Empty alt text");
     if (!image.getAttribute('width') || !image.getAttribute('height')) failures.push("Missing width/height attributes");
     if (image.getAttribute('border') !== '0') failures.push("Missing border='0' attribute");
     if (style.display !== 'block') failures.push("Missing style 'display: block;'");

     const imageSizeThreshold = 200;
     if (image.width > imageSizeThreshold) {
         if (image.style.width !== '100%') failures.push("Large image missing 'width: 100%;' for responsiveness");
         if (image.style.maxWidth !== `${image.width}px`) failures.push("Large image missing 'max-width' style to prevent upscaling");
         if (image.style.height !== 'auto') failures.push("Large image missing 'height: auto;' for correct aspect ratio");
     }

     if (failures.length > 0) results.image_failures.push({
         "Failure Reasons": failures.join(', '),
         "Image Source": src || "[Not Found]",
         "Alt Text": image.alt === null ? "[Missing]" : image.alt,
         element: image,
         failures: failures
     });
 });

 doc.body.querySelectorAll('table').forEach(table => {
     if (isElementExcluded(table)) return;
     if (table.getAttribute('border') !== '0') results.table_failures.push({
         "Reason": "Missing border='0'", "Table ID": table.id || "[no id]", "Table Class": table.className || "[no class]", element: table
     });
     if (table.getAttribute('role') !== 'presentation') results.table_failures.push({
         "Reason": "Missing role='presentation' for accessibility", "Table ID": table.id || "[no id]", "Table Class": table.className || "[no class]", element: table
     });
 });

 doc.body.querySelectorAll('a').forEach(link => {
     if (isElementExcluded(link)) return;

     const containsImage = link.querySelector('img');
     if (containsImage) {
         const linkStyle = sandboxWindow.getComputedStyle(link);
         if (linkStyle.textDecoration.includes('underline')) {
             results.linked_image_failures.push({
                 "Reason": "Link wrapping an image is missing 'text-decoration: none;'",
                 "Link Href": link.href,
                 "Contained Image": containsImage.src || "[Not Found]"
             });
         }
     }
     
     const href = link.getAttribute('href');
     if (!href) return;
     
     if (link.getAttribute('title') === 'null') results.title_null_failures.push({ "Link Text": link.innerText.trim(), "Link URL": href, element: link });
     if (!link.innerText.trim() && !(link.getAttribute('aria-label') || '').trim() && !Array.from(link.querySelectorAll('img')).some(img => (img.getAttribute('alt') || '').trim() !== '')) results.inaccessible.push(link);
     if (ignoreList.some(p => link.href.startsWith(p)) || href.startsWith('#') || ['mailto:', 'tel:', 'javascript:'].some(p => href.startsWith(p))) return;

     if (!containsImage && !validLinkColors.includes(sandboxWindow.getComputedStyle(link).color)) {
         results.link_color_failures.push({ "Link Text": link.innerText.trim(), "Invalid Color": sandboxWindow.getComputedStyle(link).color });
     }

     if (link.protocol === 'http:') results.insecure.push(link);
     if (link.target !== '_blank') results.missingTargetBlank.push(link);
     
     const paramString = `${parameterName}=`;
     if (link.href.includes(paramString) && !link.search.includes(paramString)) {
         results.sc_cid_malformed.push(link);
         return;
     }
     const occurrences = (link.search.match(new RegExp(`[?&]${parameterName}=`, 'g')) || []).length;
     if (occurrences === 0) {
         results.sc_cid_missing.push(link);
     } else {
         if (occurrences > 1) results.sc_cid_duplicate.push(link);
         if (new RegExp(`[?&]${parameterName}(?:&|$)`).test(link.search)) results.sc_cid_empty.push(link);
         if (checkSpecificValue) {
             try {
                 if (new URL(link.href).searchParams.get(parameterName) !== scCidValue) results.sc_cid_wrong_value.push(link);
             } catch (e) {}
         }
     }
 });

 return results;
}
