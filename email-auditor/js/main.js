import { dom } from './dom.js';
import { debounce } from './utils.js';
import { run as runPreAudit } from './preAuditor.js';
import { runAudit as runPostAudit } from './auditor.js';
import { applyFixes } from './refactorer.js';
import { renderResults } from './uiRenderer.js';

let lastResults = null;
let lastAuditDoc = null;

const updateInputStates = () => {
   const scCidValue = dom.scCidInput.value.trim();
   const htmlContent = dom.htmlInput.value.trim();
   const isTextareaDisabled = !scCidValue;

   if (dom.htmlInput.disabled !== isTextareaDisabled) {
       dom.htmlInput.disabled = isTextareaDisabled;
       if (isTextareaDisabled) {
           dom.htmlInput.value = '';
           lastResults = null;
           renderResults(null, null, false);
           dom.htmlInput.placeholder = "Please provide a 'sc_cid' value above to enable this field.";
       } else {
           dom.htmlInput.placeholder = "Paste your email's HTML code here... the audit will run automatically.";
       }
   }
   
   const hasIssues = lastResults && Object.values(lastResults).some(arr => arr.length > 0);
   dom.refactorButton.disabled = !scCidValue || !htmlContent || !hasIssues;
};

const processEmail = () => {
   updateInputStates();
   const htmlContent = dom.htmlInput.value;
   const scCidValue = dom.scCidInput.value.trim();
   
   dom.auditSpinner.classList.remove('d-none');

   if (!htmlContent.trim()) {
       lastResults = null;
       renderResults(null, null, false);
       dom.auditSpinner.classList.add('d-none');
       updateInputStates();
       return;
   }

   const preAuditResults = runPreAudit(htmlContent);

   const sandboxDoc = dom.sandboxFrame.contentWindow.document;
   sandboxDoc.open();
   sandboxDoc.write(htmlContent);
   sandboxDoc.close();
   lastAuditDoc = sandboxDoc;

   setTimeout(() => {
       try {
           const postAuditResults = runPostAudit(sandboxDoc, dom.sandboxFrame.contentWindow, scCidValue);
           lastResults = { ...postAuditResults, ...preAuditResults };
           renderResults(lastResults, scCidValue, true);
       } catch (e) {
           console.error("Error during audit:", e);
           dom.resultsPanel.innerHTML = `<div class="alert alert-danger" role="alert"><strong>An error occurred during the audit.</strong><br>This can happen with malformed HTML. Please check the browser console for details.</div>`;
       } finally {
           dom.auditSpinner.classList.add('d-none');
           updateInputStates();
       }
   }, 100);
};

const debouncedProcessEmail = debounce(processEmail, 500);

dom.scCidInput.addEventListener('input', () => {
   updateInputStates();
   debouncedProcessEmail();
});

dom.htmlInput.addEventListener('input', () => {
   updateInputStates();
   debouncedProcessEmail();
});

dom.refactorButton.addEventListener('click', () => {
   if (!lastResults || !lastAuditDoc) return;
   
   const spinner = dom.refactorButton.querySelector('.spinner-border');
   const buttonText = dom.refactorButton.querySelector('.button-text');

   spinner.classList.remove('d-none');
   buttonText.classList.add('d-none');
   dom.refactorButton.disabled = true;

   setTimeout(() => {
       try {
           const refactoredHtml = applyFixes(lastAuditDoc, lastResults);
           dom.refactoredCodeTextarea.value = refactoredHtml;
           dom.refactorModal.show();
       } catch (e) {
           console.error("Error during refactoring:", e);
           alert("An error occurred while refactoring the code. Please check the console for details.");
       } finally {
           spinner.classList.add('d-none');
           buttonText.classList.remove('d-none');
           updateInputStates();
       }
   }, 50);
});

dom.copyCodeButton.addEventListener('click', () => {
   dom.refactoredCodeTextarea.select();
   document.execCommand('copy');
   dom.copyCodeButton.textContent = 'Copied!';
   setTimeout(() => { dom.copyCodeButton.textContent = 'Copy Code'; }, 2000);
});

document.addEventListener('DOMContentLoaded', () => {
   document.getElementById('current-time').textContent = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' });
   updateInputStates();
});