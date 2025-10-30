/**
* Audits the raw HTML string for issues that are lost after browser parsing,
* such as duplicate attributes on the same tag.
* @param {string} htmlContent The raw HTML string.
* @returns {object} An object containing the audit results.
*/
export function run(htmlContent) {
   const results = {
       duplicate_attributes: []
   };

   // This regex finds all HTML tags and captures the tag name and the attribute string.
   const tagRegex = /<([a-z0-9]+)((?:\s+[a-zA-Z0-9\-:]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))?)*)\s*\/?>/gi;
   
   // This regex finds just the names of attributes within the attribute string.
   const attrNameRegex = /\s+([a-zA-Z0-9\-:]+)(?:\s*=|\s|>)/g;

   let tagMatch;
   while ((tagMatch = tagRegex.exec(htmlContent)) !== null) {
       const tagName = tagMatch[1];
       const attributesString = tagMatch[2];

       if (!attributesString) continue;

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
               // We can't pass a DOM element reference here, so we pass the tag string.
               // The refactorer will need to handle this differently.
               results.duplicate_attributes.push({
                   "Element": tagName.toUpperCase(),
                   "Attribute": attrName,
                   "Count": attrCounts[attrName],
                   // We need a way to find this element later for the refactorer.
                   // Let's add a unique ID during the refactoring process.
                   isRaw: true // Flag that this came from the raw audit
               });
           }
       }
   }

   // Since we can have multiple elements with the same duplicate attribute,
   // we'll just show a summary for now. The refactorer will fix all of them.
   if (results.duplicate_attributes.length > 0) {
       const uniqueFailures = new Map();
       results.duplicate_attributes.forEach(failure => {
           const key = `${failure.Element}-${failure.Attribute}`;
           if (!uniqueFailures.has(key)) {
               uniqueFailures.set(key, failure);
           }
       });
       results.duplicate_attributes = Array.from(uniqueFailures.values());
   }

   return results;
}