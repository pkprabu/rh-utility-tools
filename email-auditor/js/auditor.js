import { config } from './config.js';
function createResults() {
return {
sc_cid_malformed:           [],
sc_cid_missing:             [],
sc_cid_empty:               [],
sc_cid_duplicate:           [],
sc_cid_wrong_value:         [],
insecure:                   [],
missingTargetBlank:         [],
missingNoopener:            [],
inaccessible:               [],
empty_href:                 [],
nested_anchors:             [],
link_color_failures:        [],
title_null_failures:        [],
image_failures:             [],
background_image_failures:  [],
spacer_images:              [],       // A11
broken_image_src:           [],       // A17
relative_src_urls:          [],       // A12
table_failures:             [],
font_failures:              [],
font_size_failures:         [],       // A4
line_height_failures:       [],       // A5
trademark_failures:         [],
consecutive_trademarks:     [],
nested_sup_failures:        [],
redhat_spacing:             [],
dummy_text:                 [],
duplicate_attributes:       [],
duplicate_ids:              [],
extra_space_text:           [],
extra_space_attributes:     [],
style_blocks:               [],       // A1
css_important:              [],       // A2
unsupported_css:            [],       // A3
missing_lang:               [],       // A7
missing_title:              [],       // A8
missing_preheader:          [],       // A9
email_width_violations:     [],       // A10
missing_meta_charset:       [],       // A13
missing_viewport_meta:      [],       // A14
missing_unsubscribe:        [],       // A16
missing_physical_address:   [],       // A16
video_audio_elements:       [],       // A18
form_elements:              [],       // A19
javascript_detected:        [],       // A20
iframe_detected:            [],       // A21
commented_code:             [],       // A22
email_size_warning:         [],       // A23
};
}
function getContextSnippets(text, regex, wordsBefore, wordsAfter) {
const snippets  = [];
const localRegex = new RegExp(regex.source, 'gi');
let match;
while ((match = localRegex.exec(text)) !== null) {
const before = text.substring(0, match.index).trim().split(/\s+/).slice(-wordsBefore).join(' ');
const after  = text.substring(match.index + match[0].length).trim().split(/\s+/).slice(0, wordsAfter).join(' ');
snippets.push(`...${before} **${match[0].replace(/\s/g, '·')}** ${after}...`);
}
return snippets;
}
function buildExclusionSet(doc) {
const set = new Set();
const viewOnline = doc.body.querySelector('#view-online');
if (viewOnline) set.add(viewOnline);
const mainTables = doc.body.querySelectorAll('.mktoModule.em_main_table');
if (mainTables.length > 0) set.add(mainTables[mainTables.length - 1]);
const allModules = doc.body.querySelectorAll('.mktoModule');
if (allModules.length > 0) {
set.add(allModules[0]);
if (allModules.length > 1) set.add(allModules[allModules.length - 1]);
}
return set;
}
function makeExclusionChecker(exclusionSet) {
if (exclusionSet.size === 0) return () => false;
return (el) => {
if (!el) return false;
for (const container of exclusionSet) {
if (container === el || container.contains(el)) return true;
}
return false;
};
}
function parseCssValue(val) {
if (!val) return null;
const m = String(val).trim().match(/^([\d.]+)(px|em|rem|%|)$/);
return m ? { value: parseFloat(m[1]), unit: m[2] || 'unitless' } : null;
}
function rgbToHex(rgbStr) {
const match = String(rgbStr).match(/^rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)$/i);
if (!match) return null;
const r = parseInt(match[1], 10);
const g = parseInt(match[2], 10);
const b = parseInt(match[3], 10);
if ([r, g, b].some((v) => v < 0 || v > 255)) return null;
return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function checkConsecutiveTrademarks(doc, isExcluded, results) {
const regex    = /®\s*®/g;
const reported = new Set();
doc.body.querySelectorAll('*').forEach((el) => {
if (isExcluded(el)) return;
if (!regex.test(el.textContent)) { regex.lastIndex = 0; return; }
regex.lastIndex = 0;
let ancestor = el.parentElement;
while (ancestor) { if (reported.has(ancestor)) return; ancestor = ancestor.parentElement; }
results.consecutive_trademarks.push({ Reason: 'Consecutive ® ® symbols detected', Snippet: getContextSnippets(el.textContent, regex, 4, 4).join(' | '), element: el });
reported.add(el);
});
}
function checkFonts(doc, sandboxWindow, isExcluded, validFonts, results) {
doc.body.querySelectorAll('*').forEach((el) => {
if (isExcluded(el)) return;
if (el.children.length > 0 || (el.innerText || '').trim() === '') return;
const computed = sandboxWindow.getComputedStyle(el);
if (computed.display === 'none' || computed.visibility === 'hidden') return;
const firstFont = computed.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
if (!validFonts.includes(firstFont)) {
results.font_failures.push({ Element: el.tagName, Text: (el.innerText || '').trim().substring(0, 50) + '…', 'Invalid Font Stack': computed.fontFamily });
}
});
}
function checkBackgroundImages(doc, sandboxWindow, isExcluded, requiredImagePrefix, results) {
doc.body.querySelectorAll('*').forEach((el) => {
if (isExcluded(el)) return;
const bg = sandboxWindow.getComputedStyle(el).backgroundImage;
if (!bg || bg === 'none') return;
const urlMatch = bg.match(/url\(["']?(.+?)["']?\)/);
if (!urlMatch) return;
try {
const resolved = new URL(urlMatch[1], sandboxWindow.location.origin);
if (!resolved.href.startsWith(requiredImagePrefix)) {
results.background_image_failures.push({ Reason: `Source not from ${requiredImagePrefix}`, 'Invalid URL': urlMatch[1], Element: `${el.tagName} (id: ${el.id || 'none'})` });
}
} catch { console.warn('Could not parse background-image URL:', urlMatch[1]); }
});
}
function checkAttributeWhitespace(doc, isExcluded, results) {
doc.body.querySelectorAll('*').forEach((el) => {
if (isExcluded(el)) return;
for (const attr of el.attributes) {
if (/\s{2,}/.test(attr.value) || attr.value.trim() !== attr.value) {
results.extra_space_attributes.push({ Element: el.tagName, Attribute: attr.name, 'Problematic Value': `"${attr.value}"` });
}
}
});
}
function checkTextNodes(doc, isExcluded, dummyKeywords, results) {
const dummyRegex      = new RegExp(`\\b(${dummyKeywords.join('|')})\\b`, 'gi');
const extraSpaceRegex = /\s{2,}/g;
const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
let node;
while ((node = walker.nextNode())) {
const parent = node.parentElement;
if (!parent || isExcluded(parent)) continue;
const text = node.nodeValue;
if (dummyRegex.test(text)) { results.dummy_text.push({ snippet: getContextSnippets(text, dummyRegex, 4, 4).join(' | '), element: parent }); }
dummyRegex.lastIndex = 0;
if (extraSpaceRegex.test(text)) { results.extra_space_text.push({ Reason: 'Multiple whitespace characters found in text', Snippet: getContextSnippets(text, extraSpaceRegex, 4, 4).join(' | '), element: parent }); }
extraSpaceRegex.lastIndex = 0;
}
}
function checkRedHatSpacing(doc, isExcluded, spacingRegex, results) {
const reportedAncestors = new Set();
Array.from(doc.body.querySelectorAll('*:not(script):not(style)')).reverse().forEach((el) => {
if (reportedAncestors.has(el) || isExcluded(el)) return;
if (!spacingRegex.test(el.textContent)) { spacingRegex.lastIndex = 0; return; }
spacingRegex.lastIndex = 0;
results.redhat_spacing.push({ snippet: getContextSnippets(el.textContent, spacingRegex, 4, 4).join(' | '), element: el });
let ancestor = el.parentElement;
while (ancestor) { reportedAncestors.add(ancestor); ancestor = ancestor.parentElement; }
});
}
function stripNonContentBlocks(html) {
return html
.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '')  // MSO conditional comments
.replace(/<!--[\s\S]*?-->/g, '')                   // regular HTML comments
.replace(/<script[\s\S]*?<\/script>/gi, '')        // script blocks
.replace(/<style[\s\S]*?<\/style>/gi, '');         // style blocks
}
function checkTrademarkRaw(rawHtml, results) {
const clean = stripNonContentBlocks(rawHtml);
const TM_VARIANTS = /(&reg;|&#174;|&#[xX][aA][eE];|\u00ae)/g;
const REQUIRED_PREFIX = '<sup style="line-height:0;">';
const REQUIRED_SUFFIX = '</sup>';
const REQUIRED_CONTENT = '&reg;';  // only the named entity is accepted
let match;
while ((match = TM_VARIANTS.exec(clean)) !== null) {
const pos            = match.index;
const foundTm        = match[0];
const prefixStart    = pos - REQUIRED_PREFIX.length;
const actualPrefix   = prefixStart >= 0 ? clean.substring(prefixStart, pos) : '';
const actualSuffix   = clean.substring(pos + foundTm.length, pos + foundTm.length + REQUIRED_SUFFIX.length);
const isExactlyRight = (
foundTm       === REQUIRED_CONTENT &&
actualPrefix  === REQUIRED_PREFIX  &&
actualSuffix  === REQUIRED_SUFFIX
);
if (isExactlyRight) continue;  // correct — skip
let reason;
if (foundTm !== REQUIRED_CONTENT) {
reason = `Trademark encoded as "${foundTm}" — only &reg; is accepted. Required form: <sup style="line-height:0;">&reg;</sup>`;
} else if (actualPrefix !== REQUIRED_PREFIX) {
reason = `Incorrect <sup> wrapper. Required exactly: <sup style="line-height:0;">&reg;</sup> — check tag case, attribute spacing, extra attributes, and the trailing semicolon in the style value.`;
} else {
reason = `Missing or incorrect </sup> closing tag after &reg;`;
}
const ctxStart  = Math.max(0, pos - 50);
const ctxEnd    = Math.min(clean.length, pos + foundTm.length + 20);
const snippet   = clean.substring(ctxStart, ctxEnd)
.replace(/\n/g, ' ')
.replace(/\s{2,}/g, ' ')
.trim();
results.trademark_failures.push({ Reason: reason, Snippet: snippet });
}
}
function checkNestedSupTrademark(doc, isExcluded, results) {
const nestedSups = doc.body.querySelectorAll('sup sup');
const outermostSet = new Set();
nestedSups.forEach((inner) => {
let outermost = inner;
while (outermost.parentElement?.tagName === 'SUP') { outermost = outermost.parentElement; }
if (outermost.textContent.includes('\u00ae')) outermostSet.add(outermost);
});
outermostSet.forEach((sup) => {
if (isExcluded(sup)) return;
results.nested_sup_failures.push({
Reason:  'Incorrectly nested <sup> tags found around ® symbol.',
Snippet: sup.outerHTML,
});
});
}
function checkImages(doc, isExcluded, requiredImagePrefix, results) {
doc.body.querySelectorAll('img').forEach((img) => {
if (isExcluded(img)) return;
const failures = [];
const src = img.getAttribute('src');
if (!src || src.trim() === '') { failures.push('Missing/Empty src'); }
else if (!img.src.startsWith(requiredImagePrefix) && !img.src.startsWith('http://220-nsz-364.mktoweb.com')) { failures.push(`Source not from ${requiredImagePrefix}`); }
if (img.getAttribute('alt') === null)                            failures.push('Missing alt attribute');
if (!img.getAttribute('width') || !img.getAttribute('height'))  failures.push('Missing width/height attributes');
if (img.getAttribute('border') !== '0')                         failures.push("Missing border='0'");
if (failures.length > 0) { results.image_failures.push({ 'Failure Reasons': failures.join(', '), 'Image Source': src || '[Not Found]', 'Alt Text': img.getAttribute('alt') === null ? '[Missing]' : img.alt, element: img, failures }); }
});
}
function checkTables(doc, isExcluded, results) {
doc.body.querySelectorAll('table').forEach((table) => {
if (isExcluded(table)) return;
const id = table.id || '[no id]', cls = table.className || '[no class]';
if (table.getAttribute('border') !== '0') results.table_failures.push({ Reason: "Missing border='0'", 'Table ID': id, 'Table Class': cls, element: table });
if (table.getAttribute('role') !== 'presentation') results.table_failures.push({ Reason: "Missing role='presentation' for accessibility", 'Table ID': id, 'Table Class': cls, element: table });
});
}
function checkDuplicateIds(doc, isExcluded, results) {
const seen = new Map();
doc.body.querySelectorAll('[id]').forEach((el) => {
if (isExcluded(el)) return;
const id = el.getAttribute('id').trim();
if (!id) return;
if (seen.has(id)) {
if (seen.get(id) !== null) { results.duplicate_ids.push({ 'Duplicate ID': id, Element: seen.get(id).tagName, Snippet: seen.get(id).outerHTML.substring(0, 120) }); seen.set(id, null); }
results.duplicate_ids.push({ 'Duplicate ID': id, Element: el.tagName, Snippet: el.outerHTML.substring(0, 120) });
} else { seen.set(id, el); }
});
}
function checkNestedAnchors(doc, isExcluded, results) {
doc.body.querySelectorAll('a a').forEach((inner) => {
if (isExcluded(inner)) return;
results.nested_anchors.push({ Reason: 'Nested <a> tags are invalid HTML.', 'Outer URL': inner.closest('a').href, 'Inner URL': inner.href, Snippet: inner.outerHTML.substring(0, 120) });
});
}
function checkLinks(doc, sandboxWindow, isExcluded, auditConfig, parameterName, scCidValue, results) {
const { ignoreList, validLinkColors } = auditConfig;
const checkSpecificValue = !!scCidValue;
doc.body.querySelectorAll('a').forEach((link) => {
if (isExcluded(link)) return;
const href = link.getAttribute('href');
if (!href) return;
if (href.trim() === '') { results.empty_href.push({ 'Link Text': link.innerText.trim() || '[no text]', Snippet: link.outerHTML.substring(0, 120), element: link }); return; }
if (link.getAttribute('title') === 'null') { results.title_null_failures.push({ 'Link Text': link.innerText.trim(), 'Link URL': href, element: link }); }
const hasText = !!link.innerText.trim(), hasAriaLabel = !!(link.getAttribute('aria-label') || '').trim();
const hasImgAlt = Array.from(link.querySelectorAll('img')).some((img) => (img.getAttribute('alt') || '').trim() !== '');
if (!hasText && !hasAriaLabel && !hasImgAlt) results.inaccessible.push(link);
const isIgnored = ignoreList.some((p) => link.href.startsWith(p));
const isSpecial = href.startsWith('#') || ['mailto:', 'tel:', 'javascript:'].some((p) => href.startsWith(p));
if (isIgnored || isSpecial) return;
const computedColor    = sandboxWindow.getComputedStyle(link).color;
const computedColorHex = rgbToHex(computedColor);
if (!link.querySelector('img') && !validLinkColors.includes(computedColorHex)) {
results.link_color_failures.push({
'Link Text':     link.innerText.trim(),
'Invalid Color': computedColorHex || computedColor,
});
}
if (link.protocol === 'http:') results.insecure.push(link);
if (!link.hostname) { results.sc_cid_malformed.push({ link, reason: 'Relative URL — no hostname' }); return; }
if (link.target === '_blank') { const rel = (link.getAttribute('rel') || '').toLowerCase(); if (!rel.includes('noopener')) results.missingNoopener.push(link); }
if (link.target !== '_blank') results.missingTargetBlank.push(link);
const paramString = `${parameterName}=`;
if (link.href.includes(paramString) && !link.search.includes(paramString)) { results.sc_cid_malformed.push({ link, reason: 'Parameter not in query string' }); return; }
const occurrences = (link.search.match(new RegExp(`[?&]${parameterName}=`, 'g')) || []).length;
if (occurrences === 0) { results.sc_cid_missing.push(link); }
else {
if (occurrences > 1) results.sc_cid_duplicate.push(link);
if (new RegExp(`[?&]${parameterName}(?:&|$)`).test(link.search)) results.sc_cid_empty.push(link);
if (checkSpecificValue) { try { if (new URL(link.href).searchParams.get(parameterName) !== scCidValue) results.sc_cid_wrong_value.push(link); } catch {} }
}
});
}
function checkStyleBlocks(doc, results) {
doc.querySelectorAll('style').forEach((style) => {
const content = style.textContent.trim();
if (content) {
results.style_blocks.push({
Reason:  '<style> blocks are stripped by Gmail and many clients. All CSS must be inline.',
Snippet: content.substring(0, 200) + (content.length > 200 ? '…' : ''),
element: style,
});
}
});
}
function checkCssImportant(doc, isExcluded, results) {
doc.body.querySelectorAll('[style]').forEach((el) => {
if (isExcluded(el)) return;
if (el.getAttribute('style').includes('!important')) {
results.css_important.push({
Element: el.tagName,
Snippet: el.getAttribute('style').substring(0, 150),
element: el,
});
}
});
}
function checkUnsupportedCss(doc, isExcluded, unsupportedProps, results) {
doc.body.querySelectorAll('[style]').forEach((el) => {
if (isExcluded(el)) return;
const style = el.getAttribute('style').toLowerCase().replace(/\s/g, '');
unsupportedProps.forEach((prop) => {
const normProp = prop.toLowerCase().replace(/\s/g, '');
if (style.includes(normProp)) {
results.unsupported_css.push({
Element:  el.tagName,
Property: prop,
Snippet:  el.getAttribute('style').substring(0, 150),
element:  el,
});
}
});
});
}
function checkFontSizes(doc, isExcluded, minFontSize, results) {
doc.body.querySelectorAll('[style]').forEach((el) => {
if (isExcluded(el)) return;
const style  = el.getAttribute('style');
const match  = style.match(/font-size\s*:\s*([\d.]+)(px|pt|em|rem)/i);
if (!match) return;
const value  = parseFloat(match[1]);
const unit   = match[2].toLowerCase();
if ((unit === 'px' || unit === 'pt') && value < minFontSize) {
results.font_size_failures.push({
Element:    el.tagName,
'Font Size': `${value}${unit}`,
Minimum:    `${minFontSize}px`,
Text:       (el.innerText || '').trim().substring(0, 60),
element:    el,
});
}
});
}
function checkLineHeights(doc, isExcluded, minLineHeight, results) {
const BLOCK_TAGS = new Set(['P', 'TD', 'TH', 'DIV', 'LI', 'SPAN']);
doc.body.querySelectorAll('[style]').forEach((el) => {
if (isExcluded(el)) return;
if (!BLOCK_TAGS.has(el.tagName)) return;
if (!(el.innerText || '').trim()) return;
const style = el.getAttribute('style');
const match = style.match(/line-height\s*:\s*([\d.]+)(px|em|rem|%|)/i);
if (!match) return;
const value = parseFloat(match[1]);
const unit  = (match[2] || '').toLowerCase();
const isLow = (unit === '' || unit === 'em' || unit === 'rem') && value < minLineHeight;
if (isLow) {
results.line_height_failures.push({
Element:       el.tagName,
'Line Height': `${value}${unit}`,
Minimum:       String(minLineHeight),
Text:          (el.innerText || '').trim().substring(0, 60),
element:       el,
});
}
});
}
function checkLangAttribute(doc, results) {
const html = doc.documentElement;
if (!html) return;
const lang = html.getAttribute('lang');
if (!lang || !lang.trim()) {
results.missing_lang.push({
Reason:  'The <html> element is missing a `lang` attribute. Screen readers need it to announce the correct language.',
Snippet: html.outerHTML.substring(0, 80),
});
}
}
function checkTitleTag(doc, results) {
const title = doc.querySelector('title');
if (!title || !title.textContent.trim()) {
results.missing_title.push({
Reason: 'A <title> tag is missing or empty. Some clients display it as a preview or tab label.',
});
}
}
function checkPreheader(doc, results) {
const preheaderSelectors = [
'[class*="preheader"]', '[id*="preheader"]',
'[class*="preview"]',   '[id*="preview"]',
'[style*="mso-hide"]',  '[style*="display:none"]',
'[style*="display: none"]',
];
const found = preheaderSelectors.some((sel) => {
try { return !!doc.body.querySelector(sel); } catch { return false; }
});
if (!found) {
results.missing_preheader.push({
Reason: 'No preheader element detected. A preheader provides the preview text shown in inbox lists before the email is opened.',
});
}
}
function checkEmailWidth(doc, isExcluded, maxWidth, results) {
doc.body.querySelectorAll('table[width], td[width], div[style]').forEach((el) => {
if (isExcluded(el)) return;
let widthVal = null;
const attrWidth = el.getAttribute('width');
if (attrWidth) {
widthVal = parseInt(attrWidth, 10);
} else {
const styleWidth = (el.getAttribute('style') || '').match(/(?:^|;)\s*width\s*:\s*([\d.]+)px/i);
if (styleWidth) widthVal = parseFloat(styleWidth[1]);
}
if (widthVal !== null && !isNaN(widthVal) && widthVal > maxWidth) {
results.email_width_violations.push({
Element:        el.tagName,
'Width Found':  `${widthVal}px`,
'Max Allowed':  `${maxWidth}px`,
Snippet:        el.outerHTML.substring(0, 120),
element:        el,
});
}
});
}
function checkSpacerImages(doc, isExcluded, results) {
doc.body.querySelectorAll('img').forEach((img) => {
if (isExcluded(img)) return;
const w   = parseInt(img.getAttribute('width')  || img.width,  10);
const h   = parseInt(img.getAttribute('height') || img.height, 10);
const src = (img.getAttribute('src') || '').toLowerCase();
const alt = img.getAttribute('alt') || '';
const isSpacer =
(w <= 1 && h <= 1 && w > 0 && h > 0) ||
src.includes('spacer') ||
src.includes('blank') ||
src.includes('clear.gif') ||
src.includes('1x1') ||
(alt === '' && (w === 1 || h === 1));
if (isSpacer) {
results.spacer_images.push({
Reason:  'Spacer image detected. Use CSS padding/margins instead.',
'Image Source': img.getAttribute('src') || '[empty]',
Dimensions:    `${w || '?'}×${h || '?'}`,
element:       img,
});
}
});
}
function checkRelativeSrcUrls(doc, isExcluded, results) {
doc.querySelectorAll('img[src], video[src], source[src]').forEach((el) => {
if (isExcluded(el)) return;
const src = el.getAttribute('src') || '';
if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//') && src.trim() !== '') {
results.relative_src_urls.push({
Element:      el.tagName,
'Relative src': src,
Reason:       'Relative src URLs break when the email is opened outside its origin.',
element:      el,
});
}
});
}
function checkMetaCharset(doc, results) {
const charset = doc.querySelector('meta[charset], meta[http-equiv="Content-Type"]');
if (!charset) {
results.missing_meta_charset.push({
Reason: 'Missing <meta charset="UTF-8">. Without it, special characters may corrupt in some email clients.',
});
}
}
function checkViewportMeta(doc, results) {
const viewport = doc.querySelector('meta[name="viewport"]');
if (!viewport) {
results.missing_viewport_meta.push({
Reason: 'Missing <meta name="viewport"> tag. Required for proper mobile rendering.',
});
}
}
function checkUnsubscribeLink(doc, unsubscribeKeywords, results) {
const bodyText = (doc.body.textContent || '').toLowerCase();
const allLinks = Array.from(doc.body.querySelectorAll('a'));
const linkText = allLinks.map((a) => (a.textContent || '').toLowerCase()).join(' ');
const combined = bodyText + ' ' + linkText;
const found = unsubscribeKeywords.some((kw) => combined.includes(kw.toLowerCase()));
if (!found) {
results.missing_unsubscribe.push({
Reason: 'No unsubscribe mechanism detected. CAN-SPAM and GDPR require a visible opt-out link.',
});
}
}
function checkPhysicalAddress(doc, pattern, results) {
const text = (doc.body.textContent || '');
if (!pattern.test(text)) {
results.missing_physical_address.push({
Reason: 'No physical postal address detected. CAN-SPAM requires a postal address in every commercial email.',
});
}
}
function checkBrokenImageSrc(doc, isExcluded, placeholderDomains, results) {
doc.body.querySelectorAll('img[src]').forEach((img) => {
if (isExcluded(img)) return;
const src = img.getAttribute('src') || '';
const lower = src.toLowerCase();
const match = placeholderDomains.find((d) => lower.includes(d));
if (match) {
results.broken_image_src.push({
Reason:         `Image src points to placeholder/test domain "${match}".`,
'Image Source': src,
element:        img,
});
}
});
}
function checkVideoAudio(doc, isExcluded, results) {
doc.body.querySelectorAll('video, audio').forEach((el) => {
if (isExcluded(el)) return;
results.video_audio_elements.push({
Element: el.tagName,
Reason:  `<${el.tagName.toLowerCase()}> is not supported in most email clients and will be stripped or broken.`,
Snippet: el.outerHTML.substring(0, 120),
element: el,
});
});
}
function checkFormElements(doc, isExcluded, results) {
doc.body.querySelectorAll('form, input, select, textarea, button').forEach((el) => {
if (isExcluded(el)) return;
results.form_elements.push({
Element: el.tagName,
Reason:  `<${el.tagName.toLowerCase()}> is stripped or broken in virtually all email clients.`,
Snippet: el.outerHTML.substring(0, 120),
element: el,
});
});
}
function checkJavaScript(doc, isExcluded, results) {
doc.querySelectorAll('script').forEach((el) => {
results.javascript_detected.push({
Reason:  '<script> tags are blocked by all email clients.',
Snippet: el.outerHTML.substring(0, 120),
element: el,
});
});
doc.body.querySelectorAll('*').forEach((el) => {
if (isExcluded(el)) return;
for (const attr of el.attributes) {
if (/^on[a-z]+$/i.test(attr.name)) {
results.javascript_detected.push({
Reason:  `Inline event handler \`${attr.name}\` is blocked by email clients.`,
Snippet: el.outerHTML.substring(0, 120),
element: el,
});
}
}
});
}
function checkIframes(doc, isExcluded, results) {
doc.querySelectorAll('iframe').forEach((el) => {
if (isExcluded(el)) return;
results.iframe_detected.push({
Reason:  '<iframe> is blocked by most email clients and is a spam signal.',
Snippet: el.outerHTML.substring(0, 120),
element: el,
});
});
}
function checkCommentedCode(htmlString, results) {
const commentRegex = /<!--([\s\S]*?)-->/g;
let match;
while ((match = commentRegex.exec(htmlString)) !== null) {
const content = match[1];
const looksActive = /<[a-zA-Z]/.test(content) || /https?:\/\//.test(content) || /style\s*=/.test(content);
if (looksActive) {
results.commented_code.push({
Reason:  'HTML comment contains what appears to be active code. This adds file size and may contain outdated tracking.',
Snippet: match[0].substring(0, 200),
});
}
}
}
function checkEmailFileSize(htmlString, threshold, results) {
const bytes = new TextEncoder().encode(htmlString).length;
if (bytes > threshold) {
results.email_size_warning.push({
Reason:     `Email HTML is ${(bytes / 1024).toFixed(1)} KB, exceeding Gmail's ~100 KB clip threshold. Gmail will truncate the email with a "Message clipped" notice.`,
'Size':     `${(bytes / 1024).toFixed(1)} KB`,
Threshold:  `${(threshold / 1024).toFixed(0)} KB`,
});
}
}
export function runAudit(doc, sandboxWindow, scCidValue, rawHtml = '', enabledChecks = null) {
const enabled = (key) => !enabledChecks || enabledChecks.has(key);
const { auditor: auditConfig, parameterName } = config;
const {
requiredImagePrefix, validFonts, dummyKeywords, brandTextRules,
minFontSize, minLineHeight, maxEmailWidth, gmailClipThreshold,
unsupportedCssProperties, placeholderImageDomains,
unsubscribeKeywords, physicalAddressPattern,
} = auditConfig;
const results      = createResults();
const exclusionSet = buildExclusionSet(doc);
const isExcluded   = makeExclusionChecker(exclusionSet);
if (enabled('consecutive_trademarks'))   checkConsecutiveTrademarks(doc, isExcluded, results);
if (enabled('font_failures'))            checkFonts(doc, sandboxWindow, isExcluded, validFonts, results);
if (enabled('background_image'))         checkBackgroundImages(doc, sandboxWindow, isExcluded, requiredImagePrefix, results);
if (enabled('extra_space'))              checkAttributeWhitespace(doc, isExcluded, results);
if (enabled('text_nodes'))               checkTextNodes(doc, isExcluded, dummyKeywords, results);
if (enabled('redhat_spacing'))           checkRedHatSpacing(doc, isExcluded, brandTextRules.redHatSpacing.regex, results);
if (rawHtml && enabled('trademark_markup')) checkTrademarkRaw(rawHtml, results);
if (enabled('trademark_markup'))            checkNestedSupTrademark(doc, isExcluded, results);
if (enabled('image_failures'))           checkImages(doc, isExcluded, requiredImagePrefix, results);
if (enabled('table_failures'))           checkTables(doc, isExcluded, results);
if (enabled('duplicate_ids'))            checkDuplicateIds(doc, isExcluded, results);
if (enabled('nested_anchors'))           checkNestedAnchors(doc, isExcluded, results);
if (enabled('links'))                    checkLinks(doc, sandboxWindow, isExcluded, auditConfig, parameterName, scCidValue, results);
if (enabled('style_blocks'))             checkStyleBlocks(doc, results);
if (enabled('css_important'))            checkCssImportant(doc, isExcluded, results);
if (enabled('unsupported_css'))          checkUnsupportedCss(doc, isExcluded, unsupportedCssProperties, results);
if (enabled('font_size_failures'))       checkFontSizes(doc, isExcluded, minFontSize, results);
if (enabled('line_height_failures'))     checkLineHeights(doc, isExcluded, minLineHeight, results);
if (enabled('missing_lang'))             checkLangAttribute(doc, results);
if (enabled('missing_title'))            checkTitleTag(doc, results);
if (enabled('missing_preheader'))        checkPreheader(doc, results);
if (enabled('email_width_violations'))   checkEmailWidth(doc, isExcluded, maxEmailWidth, results);
if (enabled('spacer_images'))            checkSpacerImages(doc, isExcluded, results);
if (enabled('relative_src_urls'))        checkRelativeSrcUrls(doc, isExcluded, results);
if (enabled('missing_meta_charset'))     checkMetaCharset(doc, results);
if (enabled('missing_viewport_meta'))    checkViewportMeta(doc, results);
if (enabled('missing_unsubscribe'))      checkUnsubscribeLink(doc, unsubscribeKeywords, results);
if (enabled('missing_physical_address')) checkPhysicalAddress(doc, physicalAddressPattern, results);
if (enabled('broken_image_src'))         checkBrokenImageSrc(doc, isExcluded, placeholderImageDomains, results);
if (enabled('video_audio_elements'))     checkVideoAudio(doc, isExcluded, results);
if (enabled('form_elements'))            checkFormElements(doc, isExcluded, results);
if (enabled('javascript_detected'))      checkJavaScript(doc, isExcluded, results);
if (enabled('iframe_detected'))          checkIframes(doc, isExcluded, results);
if (rawHtml && enabled('commented_code'))    checkCommentedCode(rawHtml, results);
if (rawHtml && enabled('email_size_warning')) checkEmailFileSize(rawHtml, gmailClipThreshold, results);
return results;
}
