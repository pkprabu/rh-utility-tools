document.addEventListener('DOMContentLoaded', () => {

  // --- 1. ELEMENT REFERENCES ---
  const minutesInput = document.getElementById('minutesInput');
  const hoursInput = document.getElementById('hoursInput');
  const resultHours = document.getElementById('resultHours');
  const resultMinutes = document.getElementById('resultMinutes');
  const themeToggle = document.getElementById('themeToggle');
  const copyHoursBtn = document.getElementById('copyHoursBtn');
  const copyMinutesBtn = document.getElementById('copyMinutesBtn');
  
  // --- 2. THEME SWITCHER LOGIC ---
  const htmlElement = document.documentElement;
  
  // Function to set the correct icon based on the current theme
  const setToggleIcon = (theme) => {
      themeToggle.innerHTML = theme === 'dark' 
          ? '<i class="bi bi-sun-fill"></i>' 
          : '<i class="bi bi-moon-stars-fill"></i>';
  };

  // On load, check localStorage first. If a theme is stored, apply it.
  // Otherwise, the page uses the default from the HTML tag.
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
      htmlElement.setAttribute('data-bs-theme', savedTheme);
  }

  // Set the initial icon based on the current theme (either from localStorage or the HTML default)
  setToggleIcon(htmlElement.getAttribute('data-bs-theme'));
  
  // Listener for the toggle button
  themeToggle.addEventListener('click', () => {
      const currentTheme = htmlElement.getAttribute('data-bs-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      htmlElement.setAttribute('data-bs-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      setToggleIcon(newTheme);
  });
  
  // --- 3. CONVERTER LOGIC (TWO-WAY) ---
  function updateFromMinutes() {
      const minutes = parseFloat(minutesInput.value);
      if (isNaN(minutes) || minutes < 0) {
          resultHours.textContent = '0.00';
          return;
      }
      const decimalHours = minutes / 60;
      resultHours.textContent = decimalHours.toFixed(2);
  }
  
  function updateFromHours() {
      const hours = parseFloat(hoursInput.value);
      if (isNaN(hours) || hours < 0) {
          resultMinutes.textContent = '0';
          return;
      }
      const totalMinutes = hours * 60;
      resultMinutes.textContent = Math.round(totalMinutes);
  }

  minutesInput.addEventListener('input', () => {
      updateFromMinutes();
      const minutes = parseFloat(minutesInput.value);
      if (!isNaN(minutes) && minutes >= 0) {
          hoursInput.value = (minutes / 60).toFixed(2);
          updateFromHours();
      }
  });

  hoursInput.addEventListener('input', () => {
      updateFromHours();
      const hours = parseFloat(hoursInput.value);
      if (!isNaN(hours) && hours >= 0) {
          minutesInput.value = Math.round(hours * 60);
          updateFromMinutes();
      }
  });
  
  // --- 4. COPY TO CLIPBOARD LOGIC ---
  function setupCopyButton(button, sourceElement) {
      button.addEventListener('click', () => {
          navigator.clipboard.writeText(sourceElement.textContent).then(() => {
              const originalIcon = button.innerHTML;
              button.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
              setTimeout(() => {
                  button.innerHTML = originalIcon;
              }, 1500);
          }).catch(err => {
              console.error('Failed to copy text: ', err);
          });
      });
  }
  
  setupCopyButton(copyHoursBtn, resultHours);
  setupCopyButton(copyMinutesBtn, resultMinutes);
  
  // --- INITIALIZE ---
  updateFromMinutes();
  updateFromHours();
});
