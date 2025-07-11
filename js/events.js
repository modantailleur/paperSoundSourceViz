import { resetState, resetPitch, launchTutorial, switchTimeScale, switchNoiseMapMode, 
    switchScenario, switchTraffic, switchVoices, switchBirds, switchPeriodButtonBef, 
    switchPeriodButtonAft, switchPeriodButtonCompare, updateTutorialStepAndPage,
    switchLangButtonFR, switchLangButtonENG } from './map.js';
import { getTutorialStepDuration, viewParams } from './map.js';    

/**
 * Scales the #uiRoot container to match screen dimensions,
 * optimized for 1920x1080 development resolution.
 */
export function scaleUIRootToFitWindow() {
    const root = document.getElementById('uiRoot');

    // Optimized for 1920x1080 screen, as it was developped on one
    // The 2086 instead of 1920 accounts for the size of the browser tabs (~8% of the screen)
    const pixelsWidth = 2086;
    const pixelsHeight = 1080;

    const scaleX = window.innerWidth / pixelsWidth;
    const scaleY = window.innerHeight / pixelsHeight;
    const scale = Math.min(scaleX, scaleY); // Uniform scaling
  
    root.style.transform = `scale(${scale})`;
  
    // Optional: center it
    root.style.left = `${(window.innerWidth - pixelsWidth * scale) / 2}px`;
    root.style.top = `${(window.innerHeight - pixelsHeight * scale) / 2}px`;
}

// Prevent browser zoom (e.g., Ctrl + Scroll or Ctrl + +/-)
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '0')) {
      e.preventDefault();
    }
  });
  
document.addEventListener('wheel', function(e) {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });

/**
 * Computes how many pages exist for each tutorial step
 * based on the keys in `viewParams.curLabels`.
 */
function computePageCounts() {
    const counts = {};
    console.log('Labels:', viewParams.curLabels);
    Object.keys(viewParams.curLabels).forEach((key) => {
      const match = key.match(/^(Q\d+|Qi)_(\d+)$/);
      if (match) {
        const step = match[1];
        if (!counts[step]) counts[step] = 0;
        counts[step]++;
      }
    });
    return counts;
}
  
const pageCounts = computePageCounts();
let currentStep = 'Qi';
let currentPage = 1;
scaleUIRootToFitWindow();

console.log("Page counts:", pageCounts);

function blockAllInteraction() {
    document.getElementById('interactionBlocker').style.display = 'block';
}

function unblockAllInteraction() {
    document.getElementById('interactionBlocker').style.display = 'none';
}

function updateTutorialDisplay() {
    updateTutorialStepAndPage(currentStep, currentPage);
    document.querySelector('.tutorial-page-indicator').textContent = `${currentPage}/${pageCounts[currentStep]}`;
}
  
function setupTutorialListeners() {
    const stepButtons = document.querySelectorAll('.step-button');
    stepButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            blockAllInteraction();
            const step = btn.dataset.step;
            if (step !== currentStep) {
                currentStep = "Q" + step;
                currentPage = 1;
                updateTutorialDisplay();
            }
            disableFirstAndLastTutorialButton();
            const duration = getTutorialStepDuration(currentStep.substring(1), currentPage);
            setTimeout(() => {
                unblockAllInteraction();
            }, duration);
        });
    });

    document.getElementById('tutorialPrev').addEventListener('click', () => {
        blockAllInteraction();
        if (currentPage > 1) {
            currentPage--;
            updateTutorialDisplay();
        } else if (currentPage === 1) {
            const stepNumber = currentStep === 'Q1' ? 'i' : parseInt(currentStep.substring(1)) - 1;
            currentStep = `Q${stepNumber}`;
            currentPage = pageCounts[currentStep];
            updateTutorialDisplay();
        }
        disableFirstAndLastTutorialButton();
        const duration = getTutorialStepDuration(currentStep.substring(1), currentPage);
        setTimeout(() => {
            unblockAllInteraction();
        }, duration);
    });

    document.getElementById('tutorialNext').addEventListener('click', () => {
        blockAllInteraction();
        if (currentPage < pageCounts[currentStep]) {
            currentPage++;
            updateTutorialDisplay();
        } else if (currentPage === pageCounts[currentStep]) {
            const stepNumber = isNaN(parseInt(currentStep.substring(1))) ? 1 : parseInt(currentStep.substring(1)) + 1;
            currentStep = `Q${stepNumber}`;
            currentPage = 1;
            updateTutorialDisplay();
        } 
        disableFirstAndLastTutorialButton();
        const duration = getTutorialStepDuration(currentStep.substring(1), currentPage);
        setTimeout(() => {
            unblockAllInteraction();
        }, duration);
    });
}


export async function setupEventListeners() {

    const dropdown = document.getElementById('scenarioDropdown');
    const trafficCheckbox = document.getElementById('trafficCheckbox');
    const voicesCheckbox = document.getElementById('voicesCheckbox');
    const birdsCheckbox = document.getElementById('birdsCheckbox');

    // ✅ Ensure "lockdown" is selected on page load
    dropdown.value = "lockdown";
    await switchScenario(dropdown.value);

    trafficCheckbox.checked = true;
    voicesCheckbox.checked = true;
    birdsCheckbox.checked = true;

    document.getElementById('tutorialToggle').checked = false;

    // Event Listeners
    document.getElementById('langButtonFR').addEventListener('click', switchLangButtonFR);
    document.getElementById('langButtonENG').addEventListener('click', switchLangButtonENG);
    document.getElementById('periodButtonBef').addEventListener('click', switchPeriodButtonBef);
    document.getElementById('periodButtonAft').addEventListener('click', switchPeriodButtonAft);
    document.getElementById('periodButtonCompare').addEventListener('click', switchPeriodButtonCompare);
    document.getElementById('resetButton').addEventListener('click', resetState);
    document.getElementById('twoDButton').addEventListener('click', resetPitch);
    document.getElementById('tutorialToggle').addEventListener('click', (event) => {
        const isChecked = event.target.checked;
        launchTutorial(isChecked);
    });

    // 🔄 New Map Mode Button Listeners
    const mapModeButtonSources = document.getElementById('mapModeButtonSources');
    const mapModeButtonNoise = document.getElementById('mapModeButtonNoise');

    mapModeButtonSources.addEventListener('click', () => {
        mapModeButtonSources.classList.remove('inactive');
        mapModeButtonNoise.classList.add('inactive');
        switchNoiseMapMode(false); // Sound Sources mode
    });

    mapModeButtonNoise.addEventListener('click', () => {
        mapModeButtonSources.classList.add('inactive');
        mapModeButtonNoise.classList.remove('inactive');
        switchNoiseMapMode(true); // Noise Map mode
    });

    dropdown.addEventListener('change', (event) => {
        switchScenario(event.target.value);
    });

    trafficCheckbox.addEventListener('change', (event) => {
        switchTraffic(event.target.checked);
    });

    voicesCheckbox.addEventListener('change', (event) => {
        switchVoices(event.target.checked);
    });

    birdsCheckbox.addEventListener('change', (event) => {
        switchBirds(event.target.checked);
    });

    document.getElementById('timeScaleButtonHour').addEventListener('click', () => {
        switchTimeScale('tod');
      });
      
      document.getElementById('timeScaleButtonDay').addEventListener('click', () => {
        switchTimeScale('dow');
      });

    // Add default settings
    document.getElementById('periodButtonAft').click();
    document.getElementById('mapModeButtonSources').click();

    setupTutorialListeners();
    // Call on load and on resize
    window.addEventListener('resize', scaleUIRootToFitWindow);
    window.addEventListener('load', scaleUIRootToFitWindow);

}

/**
 * Enables/disables the "prev" and "next" buttons appropriately,
 * based on the current tutorial step and page.
 */
function disableFirstAndLastTutorialButton() {
    const prevButton = document.getElementById('tutorialPrev');
    const nextButton = document.getElementById('tutorialNext');

    // ✅ After re-enabling, check if we are at first/last page
    prevButton.disabled = currentPage === 1 && currentStep === 'Qi';
    nextButton.disabled = currentStep === Object.keys(pageCounts).slice(-1)[0] && currentPage === pageCounts[currentStep];
}