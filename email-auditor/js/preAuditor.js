const SELF_CLOSING_TAGS = new Set([
'img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base',
'col', 'embed', 'param', 'source', 'track', 'wbr',
]);
const IMPLICIT_CLOSE_MAP = {
li:       new Set(['li']),
dt:       new Set(['dt', 'dd']),
dd:       new Set(['dt', 'dd']),
tr:       new Set(['tr']),
th:       new Set(['td', 'th']),
td:       new Set(['td', 'th']),
colgroup: new Set(['colgroup']),
col:      new Set(['col']),
option:   new Set(['option', 'optgroup']),
optgroup: new Set(['option', 'optgroup']),
p:        new Set(['p']),   // <p> is implicitly closed by any block element,
};
function getLineNumber(source, index) {
return source.substring(0, index).split('\n').length;
}
function stripComments(html) {
return html
.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '')   // MSO conditional comments
.replace(/<!--[\s\S]*?-->/g, '')                    // regular HTML comments
.replace(/<script[\s\S]*?<\/script>/gi, '')         // script blocks + content
.replace(/<style[\s\S]*?<\/style>/gi, '');          // style blocks + content
}
function checkTagAttributes({
source, fullTag, tagName, attributesStr, matchIndex,
malformedOut, duplicatesOut,
}) {
const lineNumber = getLineNumber(source, matchIndex);
let openQuote = null;
for (const char of attributesStr) {
if (openQuote) {
if (char === openQuote) openQuote = null;
} else if (char === '"' || char === "'") {
openQuote = char;
}
}
if (openQuote) {
malformedOut.push({
Reason:  `Unclosed attribute value in <${tagName}> tag. A quote is missing.`,
Snippet: fullTag,
Line:    lineNumber,
});
return true;
}
const attrNameRegex = /\s+([a-zA-Z0-9-:]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))?/g;
const counts = {};
let attrMatch;
while ((attrMatch = attrNameRegex.exec(attributesStr)) !== null) {
const name = attrMatch[1].toLowerCase();
counts[name] = (counts[name] || 0) + 1;
}
for (const [attrName, count] of Object.entries(counts)) {
if (count > 1) {
duplicatesOut.push({
Element:   tagName.toUpperCase(),
Attribute: attrName,
Snippet:   fullTag,
Line:      lineNumber,
isRaw:     true,
});
}
}
return false;
}
function checkStructure(cleanHtml, resultsOut) {
const stack = [];
const tagRegex = /<(\/)?([a-zA-Z0-9:]+)[^>]*>/g;
let match;
while ((match = tagRegex.exec(cleanHtml)) !== null) {
const isClosing = match[1] === '/';
const tagName   = match[2].toLowerCase();
const line      = getLineNumber(cleanHtml, match.index);
if (SELF_CLOSING_TAGS.has(tagName)) continue;
if (!isClosing) {
const implicitlyCloses = IMPLICIT_CLOSE_MAP[tagName];
if (implicitlyCloses && stack.length > 0 && implicitlyCloses.has(stack[stack.length - 1])) {
stack.pop();
}
stack.push(tagName);
} else {
if (stack.length === 0) {
resultsOut.push({
Reason:  `Found a closing </${tagName}> tag with no corresponding opening tag.`,
Snippet: `</${tagName}>`,
Line:    line,
});
} else {
const lastOpen = stack.pop();
if (tagName !== lastOpen) {
resultsOut.push({
Reason:  `Mismatched closing tag. Expected </${lastOpen}> but found </${tagName}>.`,
Snippet: `</${tagName}>`,
Line:    line,
});
if (!IMPLICIT_CLOSE_MAP[lastOpen]) stack.push(lastOpen);
}
}
}
}
const totalLines = cleanHtml.split('\n').length;
while (stack.length > 0) {
const unclosed = stack.pop();
resultsOut.push({
Reason:  `The <${unclosed}> tag was left unclosed at the end of the document.`,
Snippet: `<${unclosed}>`,
Line:    totalLines,
});
}
}
export function run(htmlContent) {
const results = {
duplicate_attributes:    [],
malformed_html_failures: [],
structural_failures:     [],
};
const cleanHtml = stripComments(htmlContent);
const tagRegex = /<([a-zA-Z0-9:]+)([^>]*)>/g;
let tagMatch;
while ((tagMatch = tagRegex.exec(cleanHtml)) !== null) {
checkTagAttributes({
source:        cleanHtml,
fullTag:       tagMatch[0],
tagName:       tagMatch[1],
attributesStr: tagMatch[2],
matchIndex:    tagMatch.index,
malformedOut:  results.malformed_html_failures,
duplicatesOut: results.duplicate_attributes,
});
}
checkStructure(cleanHtml, results.structural_failures);
return results;
}
