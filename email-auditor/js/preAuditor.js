export function run(htmlContent) {
 const results = {
     duplicate_attributes: [],
     malformed_html_failures: [],
     structural_failures: []
 };

 const getLineNumber = (index) => {
     return htmlContent.substring(0, index).split('\n').length;
 };

 let cleanHtml = htmlContent.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '');
 cleanHtml = cleanHtml.replace(/<!--[\s\S]*?-->/g, '');
 cleanHtml = cleanHtml.replace(/]*>/i, '');

 const tagRegex = /<([a-zA-Z0-9:]+)([^>]*)>/g;
 let tagMatch;

 while ((tagMatch = tagRegex.exec(cleanHtml)) !== null) {
     const fullTag = tagMatch[0];
     const tagName = tagMatch[1];
     const attributesString = tagMatch[2];
     const lineNumber = getLineNumber(tagMatch.index);

     let inQuote = null;
     for (let i = 0; i < attributesString.length; i++) {
         const char = attributesString[i];
         if (inQuote) {
             if (char === inQuote) inQuote = null;
         } else if (char === '"' || char === "'") {
             inQuote = char;
         }
     }
     if (inQuote) {
         results.malformed_html_failures.push({
             "Reason": `Unclosed attribute value in <${tagName}> tag. A quote is missing.`,
             "Snippet": fullTag,
             "Line": lineNumber
         });
         continue;
     }

     const attrNameRegex = /\s+([a-zA-Z0-9-:]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))?/g;
     const attrNames = [];
     let attrMatch;
     while ((attrMatch = attrNameRegex.exec(attributesString)) !== null) {
         attrNames.push(attrMatch[1].toLowerCase());
     }
     const attrCounts = attrNames.reduce((acc, name) => {
         acc[name] = (acc[name] || 0) + 1;
         return acc;
     }, {});
     for (const attrName in attrCounts) {
         if (attrCounts[attrName] > 1) {
             results.duplicate_attributes.push({
                 "Element": tagName.toUpperCase(),
                 "Attribute": attrName,
                 "Snippet": fullTag,
                 "Line": lineNumber,
                 isRaw: true
             });
         }
     }
 }

 const tagStack = [];
 const structuralRegex = /<(\/)?([a-zA-Z0-9:]+)[^>]*>/g;
 const selfClosingTags = new Set(['img', 'br', 'hr', 'input', 'meta', 'link']);
 let structuralMatch;

 while ((structuralMatch = structuralRegex.exec(cleanHtml)) !== null) {
     const isClosingTag = structuralMatch[1] === '/';
     const tagName = structuralMatch[2].toLowerCase();
     const lineNumber = getLineNumber(structuralMatch.index);

     if (isClosingTag) {
         if (selfClosingTags.has(tagName)) continue;
         if (tagStack.length === 0) {
             results.structural_failures.push({ "Reason": `Found a closing </${tagName}> tag with no corresponding opening tag.`, "Snippet": `</${tagName}>`, "Line": lineNumber });
         } else {
             const lastOpenTag = tagStack.pop();
             if (tagName !== lastOpenTag) {
                 results.structural_failures.push({ "Reason": `Mismatched closing tag. Expected </${lastOpenTag}> but found </${tagName}>.`, "Snippet": `</${tagName}>`, "Line": lineNumber });
                 if (lastOpenTag !== 'p') tagStack.push(lastOpenTag);
             }
         }
     } else {
         if (!selfClosingTags.has(tagName)) {
             tagStack.push(tagName);
         }
     }
 }

 if (tagStack.length > 0) {
     while(tagStack.length > 0) {
         const unclosedTag = tagStack.pop();
         results.structural_failures.push({ "Reason": `The <${unclosedTag}> tag was left unclosed at the end of the document.`, "Snippet": `<${unclosedTag}>`, "Line": cleanHtml.split('\n').length });
     }
 }

 return results;
}
