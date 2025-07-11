import { initializeMap, setLabels } from './map.js';
import { setupEventListeners } from './events.js';
import { loadDataInterv, loadDataAVG } from './dataloader.js';
import { checkDataPath } from './config.js';
import { TVB_COLORS, TVB_COLORS_TRANSPARENT } from './config.js';

function rgbArrayToCss([r, g, b]) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  
function setColorVars() {
    const root = document.documentElement.style;

    root.setProperty('--color-traffic', rgbArrayToCss(TVB_COLORS.t));
    root.setProperty('--color-traffic-light', rgbArrayToCss(TVB_COLORS_TRANSPARENT.t));

    root.setProperty('--color-voices', rgbArrayToCss(TVB_COLORS.v));
    root.setProperty('--color-voices-light', rgbArrayToCss(TVB_COLORS_TRANSPARENT.v));

    root.setProperty('--color-birds', rgbArrayToCss(TVB_COLORS.b));
    root.setProperty('--color-birds-light', rgbArrayToCss(TVB_COLORS_TRANSPARENT.b));
}


setColorVars();
setLabels();

document.addEventListener('DOMContentLoaded', () => {
    checkDataPath().then(() => {
        return loadAllData(); // Ensures data is loaded before proceeding
    }).then(async (data) => {
        await initializeMap(data);
        await setupEventListeners(); // Ensures event listeners are set up after initialization
    }).catch(error => {
        console.error("Error loading data:", error);
    });
});

async function loadAllData() {
    const lockdownData = await loadDataForScenario("2020-01-01", "2020-03-17", "2020-03-17", "2020-05-11");
    const daynightData = await loadDataForScenario("2020-01-01", "2020-05-11", "2020-01-01", "2020-05-11", true);
    const workdayData = await loadDataForScenario("2020-01-01", "2020-05-11", "2020-01-01", "2020-05-11", false, true);

    return { lockdown: lockdownData , daynight: daynightData , workday: workdayData };
}

async function loadDataForScenario(startBef, endBef, startAft, endAft, dayNightDiff=false, weekDayDiff=false) {
    let dataAVGBef, dataTodBef, dataDowBef, dataAVGAft, dataTodAft, dataDowAft;

    if (dayNightDiff) {
        ({ dataAVG: dataAVGBef, dataTod: dataTodBef, dataDow: dataDowBef } = await fetchDataForTimeRange(startBef, endBef, "day"));
        ({ dataAVG: dataAVGAft, dataTod: dataTodAft, dataDow: dataDowAft } = await fetchDataForTimeRange(startAft, endAft, "night"));
    } else if (weekDayDiff) {
        ({ dataAVG: dataAVGBef, dataTod: dataTodBef, dataDow: dataDowBef } = await fetchDataForTimeRange(startBef, endBef, undefined, "workday"));
        ({ dataAVG: dataAVGAft, dataTod: dataTodAft, dataDow: dataDowAft } = await fetchDataForTimeRange(startAft, endAft, undefined, "saturday"));
    } else {
        ({ dataAVG: dataAVGBef, dataTod: dataTodBef, dataDow: dataDowBef } = await fetchDataForTimeRange(startBef, endBef));
        ({ dataAVG: dataAVGAft, dataTod: dataTodAft, dataDow: dataDowAft } = await fetchDataForTimeRange(startAft, endAft));
    }

    return { dataAVGBef, dataTodBef, dataDowBef, dataAVGAft, dataTodAft, dataDowAft };
}

async function fetchDataForTimeRange(startTime, endTime, periodOfDay=undefined, periodOfWeek=undefined) {
    const dataAVG = await loadDataAVG(startTime, endTime, periodOfDay, periodOfWeek);
    const dataTod = await loadDataInterv('tod', startTime, endTime, periodOfDay, periodOfWeek);
    const dataDow = await loadDataInterv('dow', startTime, endTime, periodOfDay, periodOfWeek);
    return { dataAVG, dataTod, dataDow };
}