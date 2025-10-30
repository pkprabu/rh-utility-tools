document.addEventListener('DOMContentLoaded', () => {
  const ET_ZONE = "America/New_York";
  const IST_ZONE = "Asia/Kolkata";

  // --- DOM Element Cache ---
  const generateBtn = document.getElementById('generate');
  const clearBtn = document.getElementById('clear');
  const sendDateInput = document.getElementById('sendDate');
  const eventStartInput = document.getElementById('eventStart');
  const eventEndInput = document.getElementById('eventEnd');
  const inputFields = [sendDateInput, eventStartInput, eventEndInput];

  // --- State Management ---
  function updateButtonStates() {
      const allFieldsFilled = inputFields.every(input => input.value);
      generateBtn.disabled = !allFieldsFilled;
      clearBtn.disabled = !allFieldsFilled;
  }

  // --- Clock & Date Functions ---
  function updateClocks(){
    const now = moment();
    document.getElementById("etClock").textContent = "ET: " + now.clone().tz(ET_ZONE).format("MMM D, h:mm:ss A");
    document.getElementById("istClock").textContent = "IST: " + now.clone().tz(IST_ZONE).format("MMM D, h:mm:ss A");
  }
  setInterval(updateClocks, 1000);
  updateClocks();

  function dateOnly(m) { return m.clone().format("MM/D/YYYY"); }
  function timeOnly(m) { return m.clone().format("h:mm A"); }
  function parseAsET(inputVal){ if(!inputVal) return null; return moment.tz(inputVal, "YYYY-MM-DDTHH:mm", ET_ZONE); }

  function updatePreview(inputId, previewId) {
    const val = document.getElementById(inputId).value;
    const previewEl = document.getElementById(previewId);
    if (val) {
      const m = moment.tz(val, "YYYY-MM-DDTHH:mm", ET_ZONE);
      previewEl.textContent = m.format("dddd, MMMM D, YYYY [at] h:mm A");
    } else {
      previewEl.textContent = "";
    }
  }

  // --- Event Listeners ---
  inputFields.forEach(input => {
      input.addEventListener("change", () => {
          updatePreview(input.id, input.id + "Preview");
          updateButtonStates();
      });
  });

  eventStartInput.addEventListener("change", () => {
    const startVal = eventStartInput.value;
    if (startVal) {
      eventEndInput.value = startVal;
      updatePreview("eventEnd", "eventEndPreview");
      updateButtonStates();
    }
  });

  window.copyWithFeedback = function(el, text) {
    navigator.clipboard.writeText(text);
    const original = el.innerHTML;
    el.innerHTML = "Copied!";
    el.classList.add('text-success');
    setTimeout(() => { 
      el.innerHTML = original;
      el.classList.remove('text-success');
    }, 1500);
  }

  clearBtn.addEventListener("click",()=>{
    inputFields.forEach(input => {
      input.value = "";
      updatePreview(input.id, input.id + "Preview");
    });
    document.getElementById("onDemandCheckbox").checked = false;
    document.getElementById("tableSection").style.display = "none";
    document.getElementById("tableSection").innerHTML = "";
    document.getElementById("cardsSection").innerHTML = "";
    document.getElementById("tableToggleRow").style.display = "none";
    const toggleBtn = document.getElementById("toggleTable");
    if (toggleBtn) toggleBtn.textContent = "Show Table";
    document.getElementById("output").style.display = "none";
    document.getElementById("output-placeholder").style.display = "block";
    updateButtonStates(); // Re-disable buttons
  });

  generateBtn.addEventListener("click",()=> {
    document.getElementById("output-placeholder").style.display = "none";
    document.getElementById("output").style.display = "block";

    let sendDate = parseAsET(sendDateInput.value);
    const eventStart = parseAsET(eventStartInput.value);
    const eventEnd = parseAsET(eventEndInput.value);
    const offsetDays = parseInt(document.getElementById("sendInvitationOffset").value,10);
    const onDemand = document.getElementById("onDemandCheckbox").checked;

    if(!eventStart || !eventEnd){ alert("Please enter Event Start and End dates."); return; }
    if(!sendDate && offsetDays>0){ sendDate = eventStart.clone().subtract(offsetDays, "days"); }
    if(!sendDate){ alert("Please enter a Send Date or choose an offset."); return; }

    const first01 = sendDate.clone();
    const end02_lastChance = eventStart.clone().subtract(1,"day");
    let first02a, end02a;
    if(onDemand){ first02a = sendDate.clone().add(1, "hour"); end02a = eventEnd.clone().add(1, "year"); } 
    else { first02a = sendDate.clone().add(1,"hour"); end02a = eventEnd.clone().add(1,"day"); }
    const first02b = eventEnd.clone().add(2,"hour");
    const end02b = first02b.clone().add(2,"days");
    let first02d, end02d;
    if(onDemand){ first02d = first02b.clone().add(1,"hour"); end02d = first02d.clone().add(365,"days"); }
    let first02c, end02c;
    if(onDemand){ first02c = end02b.clone().add(2, "hour"); end02c = first02c.clone().add(2, "days"); } 
    else { first02c = end02b.clone().add(2, "hour"); end02c = first02c.clone().add(2, "days"); }

    const filenameInput = `<div class="input-group mb-3"><span class="input-group-text">CSV File Name:</span><input type="text" id="csvFileName" value="schedule" class="form-control"><button class="btn btn-info" onclick="exportTableToCSV()">Export CSV</button></div>`;
    const tableHTML = filenameInput + `<table id="scheduleTable" class="table table-sm table-bordered table-dark"><thead><tr><th>Step</th><th>Date (ET)</th><th>Time (ET)</th><th>End Date (ET)</th></tr></thead><tbody><tr><td>Send Date & Time</td><td>${sendDate ? dateOnly(sendDate) : "--"}</td><td>${sendDate ? timeOnly(sendDate) : "--"}</td><td>--</td></tr><tr><td>Event Start</td><td>${dateOnly(eventStart)}</td><td>${timeOnly(eventStart)}</td><td>--</td></tr><tr><td>Event End</td><td>${dateOnly(eventEnd)}</td><td>${timeOnly(eventEnd)}</td><td>--</td></tr><tr><td>01 Send Email Invitation & Seedlist</td><td>${dateOnly(first01)}</td><td>${timeOnly(first01)}</td><td>--</td></tr><tr><td>02 Last Chance</td><td>--</td><td>--</td><td>${dateOnly(end02_lastChance)}</td></tr><tr><td>02a Status Change - Registrants</td><td>${dateOnly(first02a)}</td><td>${timeOnly(first02a)}</td><td>${dateOnly(end02a)}</td></tr><tr><td>02b Status Change - Attended</td><td>${dateOnly(first02b)}</td><td>${timeOnly(first02b)}</td><td>${dateOnly(end02b)}</td></tr>${onDemand ? `<tr><td>02d Status Change - Attended OnDemand</td><td>${dateOnly(first02d)}</td><td>${timeOnly(first02d)}</td><td>${dateOnly(end02d)}</td></tr>` : ""}<tr><td>02c Status Change - No Show</td><td>${dateOnly(first02c)}</td><td>${timeOnly(first02c)}</td><td>${dateOnly(end02c)}</td></tr></tbody></table>`;
    
    let cardHTML = `<div class="card output-card invitation mb-3"><div class="card-body"><strong>01 Send Email Invitation and Seedlist Campaign</strong><br>First run: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(first01)}')">${dateOnly(first01)}</span> at <span class="copyable" onclick="copyWithFeedback(this, '${timeOnly(first01)}')">${timeOnly(first01)}</span> (ET)</div></div>`;
    cardHTML += `<div class="card output-card lastchance mb-3"><div class="card-body"><strong>02 Last Chance</strong><br>End date: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(end02_lastChance)}')">${dateOnly(end02_lastChance)}</span></div></div>`;
    cardHTML += `<div class="card output-card registrants mb-3"><div class="card-body"><strong>02a Status Change - Registrants</strong><br>Schedule: Daily<br>First run: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(first02a)}')">${dateOnly(first02a)}</span> at <span class="copyable" onclick="copyWithFeedback(this, '${timeOnly(first02a)}')">${timeOnly(first02a)}</span> (ET)<br>End date: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(end02a)}')">${dateOnly(end02a)}</span></div></div>`;
    cardHTML += `<div class="card output-card attended mb-3"><div class="card-body"><strong>02b Status Change - Attended</strong><br>Schedule: Daily<br>First run: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(first02b)}')">${dateOnly(first02b)}</span> at <span class="copyable" onclick="copyWithFeedback(this, '${timeOnly(first02b)}')">${timeOnly(first02b)}</span> (ET)<br>End date: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(end02b)}')">${dateOnly(end02b)}</span></div></div>`;
    if(onDemand){ cardHTML += `<div class="card output-card ondemand mb-3"><div class="card-body"><strong>02d Status Change - Attended OnDemand</strong><br>Schedule: Daily<br>First run: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(first02d)}')">${dateOnly(first02d)}</span> at <span class="copyable" onclick="copyWithFeedback(this, '${timeOnly(first02d)}')">${timeOnly(first02d)}</span> (ET)<br>End date: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(end02d)}')">${dateOnly(end02d)}</span></div></div>`; }
    cardHTML += `<div class="card output-card noshow mb-3"><div class="card-body"><strong>02c Status Change - No Show</strong><br>Schedule: Daily<br>First run: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(first02c)}')">${dateOnly(first02c)}</span> at <span class="copyable" onclick="copyWithFeedback(this, '${timeOnly(first02c)}')">${timeOnly(first02c)}</span> (ET)<br>End date: <span class="copyable" onclick="copyWithFeedback(this, '${dateOnly(end02c)}')">${dateOnly(end02c)}</span></div></div>`;

    document.getElementById("tableSection").innerHTML = tableHTML;
    document.getElementById("cardsSection").innerHTML = cardHTML;
    document.getElementById("tableToggleRow").style.display = "flex";
    const toggleBtn = document.getElementById("toggleTable");
    document.getElementById("tableSection").style.display = "none";
    toggleBtn.textContent = "Show Table";
    toggleBtn.onclick = () => {
      const sec = document.getElementById("tableSection");
      const isHidden = sec.style.display === "none";
      sec.style.display = isHidden ? "block" : "none";
      toggleBtn.textContent = isHidden ? "Hide Table" : "Show Table";
    };
  });

  window.exportTableToCSV = function() {
    const table = document.getElementById("scheduleTable");
    if(!table){ alert("No table to export."); return; }
    const rows = table.querySelectorAll("tr");
    const csv = [];
    rows.forEach(row => {
      const cols = row.querySelectorAll("td, th");
      const rowData = [];
      cols.forEach(col => rowData.push(`"${col.innerText}"`));
      csv.push(rowData.join(","));
    });
    const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    const filename = (document.getElementById("csvFileName")?.value || "schedule") + ".csv";
    const link = document.createElement("a");
    link.download = filename;
    link.href = window.URL.createObjectURL(csvFile);
    link.click();
  }

  // Initial state check on page load
  updateButtonStates();
});