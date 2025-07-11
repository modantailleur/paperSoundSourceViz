const { DeckGL, FlyToInterpolator, LightingEffect, AmbientLight } = deck;
import { INITIAL_VIEW_STATE } from './config.js';
import { createRoseDiagrams, createdataVases, create2DDataVases} from './layers.js';
import { formatTime, getPeriodLabel, zoomToZoomLevel, zoomLevelToRosesSize } from './utils.js';
import { ViewParameters } from './view.js';

// GLOBAL VARIABLES
// Declare deck.gl instance (will be initialized later)
let deckgl;
// Create and export a global instance of ViewParameters to track visualization state
export let viewParams = new ViewParameters();
// Internal variable to control zoom animations smoothly
let zoomAnimationController = null;
// Timeout ID for zoom animation debounce
let animationTimeout = null;
// Cache the last applied zoom level (to avoid redundant updates)
let lastZoomLevel = null;
// Delay in milliseconds used for debouncing zoom level changes
const DEBOUNCE_DELAY = 200; // Adjust this value if necessary
// Last click time to prevent rapid consecutive clicks
let lastClickTime = 0;

/**
 * Initializes the deck.gl + MapLibre map with rose glyphs and interactive controls.
 *
 * @param {Object} data - Raw sensor dataset used for rendering.
 */
export async function initializeMap(data) {
    try {
        await viewParams.initialize(data);

        const ambientLight = new AmbientLight({
            color: [255, 255, 255],
            intensity: 2
        });

        const lightingEffect = new LightingEffect({ ambientLight });
        const roseDiagramLayer = createRoseDiagrams(viewParams.scenarioData.dataAVGBef, viewParams.colorsBef, 
                                viewParams.scenarioData.dataAVGAft, viewParams.colorsAft, viewParams.activeSources, 
                                viewParams.curLabels, 0, viewParams.rosesRadius, viewParams.hiddenCountsMap, 
                                viewParams.sensorsSourceLabelDisplayed);

        deckgl = new DeckGL({
            container: 'deckMapContainer',
            map: maplibregl,  
            mapStyle: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
            initialViewState: INITIAL_VIEW_STATE,
            useDevicePixels: false,
            controller: {
                type: deck.MapController,
                minZoom: 12.7, // Prevent zooming out past level 6
                scrollZoom: !viewParams.lockZoom,
                dragPan: !viewParams.lockMove,
                dragRotate: !viewParams.lockTurnView,
                doubleClickZoom: !viewParams.lockZoom,
                touchZoom: !viewParams.lockZoom,
                touchRotate: !viewParams.lockTurnView
                // maxPitch: 90 // Allow full 90 degree pitch
            },
            // controller: true,
            getTooltip: ({ object }) => {
            if (object && object.sensor) {
                const timeLabel = object.interval !== undefined ? formatTime(object.interval, 
                    viewParams.currentTimeScale, viewParams.curLabels.lang) : null; // Check if interval exists or is 0
                const periodLabel = object.isBefore !== undefined 
                ? (object.isBefore ? getPeriodLabel(viewParams.curLabels)[viewParams.scenario].bef 
                : getPeriodLabel(viewParams.curLabels)[viewParams.scenario].aft) 
                : null;

                return {
                html: `<div style="font-size: 20px; font-weight: bold; color: #fff;">
                    ${viewParams.curLabels.MOSensor}: ${object.sensor} <br>
                    ${periodLabel ? `${viewParams.curLabels.MOPeriod}: ${periodLabel}<br>` : ''}
                    ${timeLabel ? `${viewParams.curLabels.MOTime}: ${timeLabel}` : ''}
                       </div>`,
                style: {
                    backgroundColor: "rgba(0, 0, 0, 0.8)", 
                    padding: "10px",
                    borderRadius: "5px"
                }
                };
            }
            return null;
            },
            effects: [lightingEffect],
            layers: [roseDiagramLayer], 
            onClick: handleMapClick,
            // Capture and store the current view state
            onViewStateChange: ({ viewState }) => {
                viewStateChange(viewState);
            }
        });
    } catch (error) {
        console.error("Error initializing map:", error);
    }
}

// Easing function for smooth animations (slows down toward the end)
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Handles updates when the map view changes (camera zoom, pan, rotate).
 * Debounces zoom changes and enforces movement bounds.
 * @param {Object} viewState - Current camera/view parameters.
 */
async function viewStateChange(viewState) {
    if (viewParams.lockViewStateChange) return; // Skip if locked

    // Only clamp if the bounds are defined
    if (viewParams.min_lat !== null && viewParams.max_lat !== null) {
        viewState.latitude = Math.max(viewParams.min_lat, Math.min(viewParams.max_lat, viewState.latitude));
    }
    if (viewParams.min_lng !== null && viewParams.max_lng !== null) {
        viewState.longitude = Math.max(viewParams.min_lng, Math.min(viewParams.max_lng, viewState.longitude));
    }

    // Clear the timeout if the function is called repeatedly
    if (animationTimeout) clearTimeout(animationTimeout);

    // Debounce the animation trigger
    animationTimeout = setTimeout(() => {
        performZoomAnimation(viewState);
    }, DEBOUNCE_DELAY);
}

/**
 * Smoothly animates the change in glyph radius when the zoom level changes.
 * Uses easing and interpolates between rose radius values.
 * @param {Object} viewState - The target camera/view state to animate to.
 */
async function performZoomAnimation(viewState) {

    // If a previous animation is in progress, cancel it
    if (zoomAnimationController) {
        zoomAnimationController.abort();
        zoomAnimationController = null;
    }

    const newZoomLevel = zoomToZoomLevel(viewState.zoom);
    const oldZoomLevel = lastZoomLevel !== null ? lastZoomLevel : zoomToZoomLevel(viewParams.curViewState.zoom);

    if (newZoomLevel === oldZoomLevel) {
        // console.log('Zoom level is the same, no animation needed.');
        viewParams.curViewState = { ...viewState };
        // viewParams.resetDataFromZoom(newZoomLevel);
        return;
    }

    zoomAnimationController = new AbortController();
    const { signal } = zoomAnimationController;

    const newRadius = zoomLevelToRosesSize[newZoomLevel];
    const oldRadius = zoomLevelToRosesSize[oldZoomLevel];

    const duration = 500;
    const startTime = performance.now();
    lastZoomLevel = newZoomLevel;

    async function animateRadiusStep(currentTime) {
        if (signal.aborted) {
            console.log('Animation aborted.');
            viewParams.curViewState = { ...viewState };
            viewParams.resetDataFromZoom(newZoomLevel);
            lastZoomLevel = newZoomLevel;
            return; // Stop the animation if aborted
        }

        const elapsed = currentTime - startTime;
        const t = Math.min(elapsed / duration, 1);
        const easedT = easeOutCubic(t);

        viewParams.filterData(newZoomLevel); // Only filter data when zoom level changes
        viewParams.rosesRadius = oldRadius + (newRadius - oldRadius) * easedT;

        await refreshData();

        if (t < 1) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            await animateRadiusStep(performance.now());
        } else {
            viewParams.curViewState = { ...viewState };
            viewParams.resetDataFromZoom(viewState.zoom);
            lastZoomLevel = newZoomLevel;
            await refreshData();
            zoomAnimationController = null;
        }
    }

    await animateRadiusStep(performance.now());
}

/**
 * Handles user click events on the map.
 * Selects a sensor if a glyph was clicked, and triggers UI updates accordingly.
 * 
 * @param {Object} info - Information about the clicked object from Deck.gl.
 */
async function handleMapClick(info) {
    if (!info.object) return;
    if (viewParams.lockVases) return; // Prevent any clicks when vases are locked
    const clickedSensor = info.object.sensor;
    if (!clickedSensor) return;

    viewParams.selectSensor(clickedSensor);

    updateToggleTimeScaleButtonVisibility();
    refreshData();
}

/**
 * Refreshes the visualization layers based on current selection, view mode, and data.
 * Converts selected rose glyphs into vases and re-renders the full visualization.
 */
export async function refreshData() {
    if (!viewParams.scenarioData) {
        console.error("❌ No data available!");
        return;
    }

    // Update existing selected sensors with new dataset
    const dataVasesLayers = Array.from(viewParams.selectedSensors).flatMap(sensor => {
        const sensorDataIntervBef = viewParams.currentTimeScale === 'tod' 
            ? (viewParams.scenarioData.dataTodBef ? viewParams.scenarioData.dataTodBef.filter(d => d.sensor === sensor) : undefined) 
            : (viewParams.scenarioData.dataDowBef ? viewParams.scenarioData.dataDowBef.filter(d => d.sensor === sensor) : undefined);
        const sensorDataIntervAft = viewParams.currentTimeScale === 'tod' 
            ? (viewParams.scenarioData.dataTodAft ? viewParams.scenarioData.dataTodAft.filter(d => d.sensor === sensor) : undefined) 
            : (viewParams.scenarioData.dataDowAft ? viewParams.scenarioData.dataDowAft.filter(d => d.sensor === sensor) : undefined);
        const sensorDataAVGBef = viewParams.scenarioData.dataAVGBef ? viewParams.scenarioData.dataAVGBef.filter(d => d.sensor === sensor) : undefined;
        const sensorDataAVGAft = viewParams.scenarioData.dataAVGAft ? viewParams.scenarioData.dataAVGAft.filter(d => d.sensor === sensor) : undefined;
        return createdataVases(sensorDataAVGBef, sensorDataIntervBef, viewParams.colorsBef, sensorDataAVGAft, sensorDataIntervAft, viewParams.colorsAft, viewParams.activeSources, viewParams.curLabels, viewParams.currentTimeScale, viewParams.rosesRadius, viewParams.period, viewParams.hiddenCountsMap);
    });

    // Keep all rose diagrams, only convert clicked ones into vases
    const remainingRoseDiagrams = createRoseDiagrams(
        viewParams.scenarioData.dataAVGBef ? viewParams.scenarioData.dataAVGBef.filter(d => !viewParams.selectedSensors.has(d.sensor)) : undefined, // Keep others (After, if available)
        viewParams.colorsBef,
        viewParams.scenarioData.dataAVGAft ? viewParams.scenarioData.dataAVGAft.filter(d => !viewParams.selectedSensors.has(d.sensor)) : undefined, // Keep others (After, if available)
        viewParams.colorsAft,
        viewParams.activeSources,
        viewParams.curLabels,
        0,
        viewParams.rosesRadius,
        viewParams.hiddenCountsMap, 
        viewParams.sensorsSourceLabelDisplayed
    );

    // Merge updated layers
    const allLayers = [
        ...(Array.isArray(remainingRoseDiagrams) ? remainingRoseDiagrams : [remainingRoseDiagrams]),
        ...dataVasesLayers
    ];

    deckgl.setProps({ layers: allLayers });
    twoDProj();
    console.log("✅ Data refreshed.");
}

/**
 * Shows or hides the time scale toggle UI based on whether any sensors are selected.
 */
function updateToggleTimeScaleButtonVisibility() {
    const container = document.getElementById('timeScaleToggleContainer');
    if (viewParams.selectedSensors.size > 0) {
        container.style.display = 'inline-block';  // Show the toggle container
    } else {
        container.style.display = 'none';          // Hide the toggle container
    }
}

/**
 * Resets the visualization to its default state:
 * - Clears selected sensors
 * - Hides the time scale toggle
 * - Animates the map back to its initial view
 * - Resets data based on default zoom level
 */
export async function resetState() {
    const currentTime = Date.now();
    if (currentTime - lastClickTime < 750) {
        console.log("Click ignored: too soon since the last click.");
        return;
    }
    lastClickTime = currentTime;

    if (zoomAnimationController) {
        console.log("Zoom animation in progress, resetState aborted.");
        return;
    }

    viewParams.selectedSensors.clear();
    updateToggleTimeScaleButtonVisibility();
    await changeView(viewParams.resetViewState);
    viewParams.resetDataFromZoom(viewParams.resetViewState.zoom);
    // refreshData();
}
/**
 * Smoothly transitions the map view to a new view state using Deck.gl's FlyToInterpolator.
 * 
 * @param {Object} view - The target view state (e.g., zoom, latitude, longitude, bearing).
 * @param {number} transitionDuration - Duration of the transition in milliseconds (default: 500ms).
 */
export async function changeView(view, transitionDuration = 500) {
    // For some reason, the map zoom behavior becomes incorrect unless we first
    // apply a view state change with only the bearing updated.
    // This acts as a workaround (possibly a Deck.gl internal interpolation bug).

    const { curBearing, ...curRestViewState } = viewParams.curViewState;
    curRestViewState.zoom = curRestViewState.zoom;

    await deckgl.setProps({
        initialViewState: {
            ...curRestViewState,
            bearing: view.bearing,
            transitionInterpolator: new FlyToInterpolator({ speed: 2 }),
            transitionDuration: transitionDuration,
        },
    });

    await deckgl.setProps({
        initialViewState: {
            ...view,
            transitionInterpolator: new FlyToInterpolator({ speed: 2 }),
            transitionDuration: transitionDuration,
        },
    });

    await new Promise(resolve => setTimeout(resolve, transitionDuration));
}

/**
 * Resets the map pitch to a top-down (2D) view while keeping the current position and zoom.
 * Clears sensor selections and updates the visualized layers.
 */
export async function resetPitch() {

    viewParams.selectedSensors.clear();
    refreshData();
    updateToggleTimeScaleButtonVisibility();

    await deckgl.setProps({
        initialViewState: {
            ...{
                latitude: viewParams.curViewState.latitude,
                longitude: viewParams.curViewState.longitude,
                zoom: viewParams.curViewState.zoom,
                bearing: viewParams.curViewState.bearing,
                pitch: 0,  // Reset pitch to 0 for 2D view
                transitionInterpolator: new FlyToInterpolator({ speed: 2 }),
                transitionDuration: 'auto',
            },
            controller: true
        }
    }); 
}

/**
 * Enables or disables the tutorial interface and adjusts map interaction behavior accordingly.
 *
 * @param {boolean} isChecked - If true, the tutorial is launched; if false, it is exited.
 */
export async function launchTutorial(isChecked) {
    const tutorialPopup = document.getElementById('tutorialPopup');
    if (tutorialPopup) {
        tutorialPopup.style.display = isChecked ? 'block' : 'none';
    }

    if (!isChecked) {
        viewParams.lockViewStateChange = false;
        viewParams.lockZoom = false;
        viewParams.lockMove = false;
        viewParams.lockTurnView = false;
        viewParams.lockVases = false;
        viewParams.sensorsSourceLabelDisplayed = [];
        viewParams.displayedSensors = ["all"];
        applyInteractionLocks();
        document.getElementById('scenarioDropdown').style.display = 'block';
        showMapModeContainer();
        resetDisplay();
        resetState();
    } else {
        document.getElementById('scenarioDropdown').style.display = 'none';
        hideMapModeContainer();
        document.querySelector('.step-button[data-step="i"]').click();
    }
}

/**
 * Toggles compare mode on or off and updates the visualization accordingly.
 *
 * @param {boolean} isChecked - True to activate compare mode (show before/after),
 *                              False to show only the selected period (bef or aft).
 */
export function switchCompareMode(isChecked) {
    if (!viewParams.scenarioData) return;

    viewParams.switchCompareParameters(isChecked);
    console.log("Switching compare mode:", isChecked);
    refreshData();
}

/**
 * Toggles the noise map mode (Laeq) on or off.
 * When enabled, disables other sound source checkboxes and focuses on Laeq.
 * When disabled, shows the regular sound source selection UI.
 *
 * @param {boolean} isChecked - True to enable noise map mode (Laeq), false to disable it.
 */
export function switchNoiseMapMode(isChecked) {
    if (!viewParams.scenarioData) return;

    const soundSourceContainer = document.getElementById('soundSourceContainer');

    if (isChecked) {
        soundSourceContainer.style.display = 'none';   // Hide button
        viewParams.switchLaeqParameters(true);        // Activate Laeq
    } else {
        soundSourceContainer.style.display = 'block';  // Show button
        viewParams.switchLaeqParameters(false);       // Deactivate Laeq
    }

    viewParams.switchNoiseMapModeParameters(isChecked);
    refreshData();
}

/**
 * Switches the visualization to a different scenario (e.g., lockdown, daynight, workday).
 * Updates the button labels and reinitializes the data for the selected scenario.
 *
 * @param {string} scenario - One of 'lockdown', 'daynight', or 'workday'.
 */
export async function switchScenario(scenario) {
    viewParams.switchScenarioParameters(scenario);
    const periodButtonBef = document.getElementById('periodButtonBef');
    const periodButtonAft = document.getElementById('periodButtonAft');
    periodButtonBef.textContent = viewParams.textButtonBef;
    periodButtonAft.textContent = viewParams.textButtonAft;
    await viewParams.initialize(viewParams.data);
    refreshData();
}

/**
 * Updates the displayed dataset by filtering out sensors not in viewParams.displayedSensors.
 * If "all" sensors are selected, it reloads the full dataset.
 */
export async function updateDisplayData() {
    const copyData = structuredClone(viewParams.data);

    if (viewParams.displayedSensors.includes("all")) {
        return viewParams.initialize(copyData, false);
    }

    const filteredData = Object.fromEntries(
        Object.entries(copyData).map(([key, value]) => {
            const filteredValue = Object.fromEntries(
                Object.entries(value).map(([dataKey, dataArray]) => {
                    if (Array.isArray(dataArray)) {
                        return [
                            dataKey,
                            dataArray.filter(dataItem => {
                                if (dataItem.sensor) {
                                    return viewParams.displayedSensors.includes(dataItem.sensor);
                                }
                                return false;
                            })
                        ];
                    }
                    return [dataKey, dataArray];
                })
            );
            return [key, filteredValue];
        })
    );

    await viewParams.initialize(filteredData, false);
}

/**
 * Switches the time scale view mode between 'tod' (time of day) and 'dow' (day of week).
 * Updates the button states and triggers data refresh accordingly.
 *
 * @param {string} timeScale - Either 'tod' or 'dow', representing the desired time scale.
 */
export function switchTimeScale(timeScale) {
    if (timeScale === viewParams.currentTimeScale) {
        return; // Skip if already in this mode
    }
    
    const hourButton = document.getElementById('timeScaleButtonHour');
    const dayButton = document.getElementById('timeScaleButtonDay');
  
    if (timeScale === 'tod') {
      hourButton.classList.remove('inactive');
      dayButton.classList.add('inactive');
    } else {
      hourButton.classList.add('inactive');
      dayButton.classList.remove('inactive');
    }
  
    viewParams.switchTimeScaleParameters();
    refreshData();
}

/**
 * Toggle traffic source visibility.
 * @param {boolean} isChecked - Whether traffic should be shown.
 */
export function switchTraffic(isChecked) {
    console.log('Switching traffic');
    viewParams.switchTrafficParameters(isChecked);
    console.log(viewParams.activeSources);
    refreshData();
}

/**
 * Toggle voices source visibility.
 * @param {boolean} isChecked - Whether voices should be shown.
 */
export function switchVoices(isChecked) {
    console.log('Switching voices');
    viewParams.switchVoicesParameters(isChecked);
    console.log(viewParams.activeSources);
    refreshData();
}

/**
 * Toggle birds source visibility.
 * @param {boolean} isChecked - Whether birds should be shown.
 */
export function switchBirds(isChecked) {
    console.log('Switching birds');
    viewParams.switchBirdsParameters(isChecked);
    console.log(viewParams.activeSources);
    refreshData();
}

/**
 * Enable or disable LAeq visualization.
 * Resets all other active sources and disables Leq checkbox if active.
 * @param {boolean} isChecked - Whether LAeq should be shown.
 */
export function switchLaeq(isChecked) {
    console.log('Switching Laeq');
    viewParams.resetActiveSources();
    viewParams.switchLaeqParameters(isChecked);
    const leqCheckbox = document.getElementById('leqCheckbox');
    leqCheckbox.checked = false;
    console.log(viewParams.activeSources);
    refreshData();
}

/**
 * Enable or disable Leq visualization.
 * Resets all other active sources and disables Laeq checkbox if active.
 * @param {boolean} isChecked - Whether Leq should be shown.
 */
export function switchLeq(isChecked) {
    console.log('Switching Leq');
    viewParams.resetActiveSources();
    viewParams.switchLeqParameters(isChecked);
    const laeqCheckbox = document.getElementById('laeqCheckbox');
    laeqCheckbox.checked = false;
    console.log(viewParams.activeSources);
    refreshData();
}

/**
 * Handles UI and state update when switching to the "Before" period mode.
 * - Highlights the "Before" button.
 * - Deactivates "Compare" and "After" buttons.
 * - Updates view parameters and triggers data refresh.
 */
export async function switchPeriodButtonBef() {
    const periodButtonBef = document.getElementById('periodButtonBef');
    const periodButtonCompare = document.getElementById('periodButtonCompare');
    const periodButtonAft = document.getElementById('periodButtonAft');
    periodButtonBef.classList.add('active');
    periodButtonBef.classList.remove('inactive');
    periodButtonCompare.classList.add('inactive');
    periodButtonCompare.classList.remove('active');
    periodButtonAft.classList.add('inactive');
    periodButtonAft.classList.remove('active');
    viewParams.period = "bef"
    viewParams.filterData()
    viewParams.switchCompareParameters(false);
    refreshData();
}

/**
 * Switches the interface and data to the "After" period mode.
 * - Highlights the "After" button.
 * - Deactivates "Before" and "Compare" buttons.
 * - Updates internal period state and refreshes the visualization.
 */
export async function switchPeriodButtonAft() {
    const periodButtonBef = document.getElementById('periodButtonBef');
    const periodButtonCompare = document.getElementById('periodButtonCompare');
    const periodButtonAft = document.getElementById('periodButtonAft');
    periodButtonBef.classList.add('inactive');
    periodButtonBef.classList.remove('active');
    periodButtonCompare.classList.add('inactive');
    periodButtonCompare.classList.remove('active');
    periodButtonAft.classList.add('active');
    periodButtonAft.classList.remove('inactive');
    viewParams.period = "aft"
    viewParams.filterData()
    viewParams.switchCompareParameters(false);
    refreshData();
}

/**
 * Activates the "Compare" period mode in the UI and visualization.
 * - Highlights the "Compare" button.
 * - Deactivates "Before" and "After" buttons.
 * - Enables compare mode in viewParams and refreshes the map layers.
 */
export async function switchPeriodButtonCompare() {
    if (!viewParams.scenarioData) return;
    const periodButtonBef = document.getElementById('periodButtonBef');
    const periodButtonCompare = document.getElementById('periodButtonCompare');
    const periodButtonAft = document.getElementById('periodButtonAft');
    periodButtonBef.classList.add('inactive');
    periodButtonBef.classList.remove('active');
    periodButtonCompare.classList.add('active');
    periodButtonCompare.classList.remove('inactive');
    periodButtonAft.classList.add('inactive');
    periodButtonAft.classList.remove('active');
    viewParams.switchCompareParameters(true);
    console.log("Switching compare mode:", true);
    refreshData();
}

/**
 * Renders a 2D projection chart of the 3D data vases (`create2DDataVases`) for the currently selected sensors.
 * If no sensors are selected or no relevant data is found, the chart is removed.
 */
export function twoDProj() {
    if (!viewParams.scenarioData || viewParams.selectedSensors.size === 0) {
        console.warn("⚠️ No data or no selected sensors.");

        // 🧹 Remove the container if it exists
        const twoDContainer = document.getElementById('twoDContainer');
        const timeScaleToggleContainer = document.getElementById('timeScaleToggleContainer');
        if (twoDContainer) {
            twoDContainer.remove();
            timeScaleToggleContainer.style.display = 'none'; // Hide the container
            console.log("🗑️ Removed #twoDContainer due to no selected sensors.");
        }

        return;
    }

    const scenarioData = viewParams.scenarioData;
    let selectedSensors = new Set(viewParams.selectedSensors);

    // Remove sensors from selectedSensors if they are not in scenarioData
    selectedSensors.forEach(sensor => {
        const isSensorInPeriodData = scenarioData.dataAVGBef?.some(d => d.sensor === sensor) || 
                                     scenarioData.dataAVGAft?.some(d => d.sensor === sensor);
        if (!isSensorInPeriodData) {
            selectedSensors.delete(sensor);
            console.log(`🗑️ Removed sensor ${sensor} from selectedSensors as it is not in scenarioData.`);
        }
    });

    // Get relevant before/after interval data
    const dataIntervBef = viewParams.currentTimeScale === 'tod'
        ? scenarioData.dataTodBef?.filter(d => viewParams.selectedSensors.has(d.sensor))
        : scenarioData.dataDowBef?.filter(d => viewParams.selectedSensors.has(d.sensor));

    const dataIntervAft = viewParams.currentTimeScale === 'tod'
        ? scenarioData.dataTodAft?.filter(d => viewParams.selectedSensors.has(d.sensor))
        : scenarioData.dataDowAft?.filter(d => viewParams.selectedSensors.has(d.sensor));

    if ((!dataIntervBef || dataIntervBef.length === 0) && (!dataIntervAft || dataIntervAft.length === 0)) {
        console.warn("⚠️ No interval data available for before or after.");

        // 🧹 Remove the container if it exists
        const twoDContainer = document.getElementById('twoDContainer');
        const timeScaleToggleContainer = document.getElementById('timeScaleToggleContainer');
        if (twoDContainer) {
            twoDContainer.remove();
            timeScaleToggleContainer.style.display = 'none'; // Hide the container
            console.log("🗑️ Removed #twoDContainer due to no interval data.");
        }

        return;
    }

    // Use or create the styled container
    let twoDContainer = document.getElementById('twoDContainer');
    if (!twoDContainer) {
        twoDContainer = document.createElement('div');
        twoDContainer.id = 'twoDContainer';
        document.getElementById('uiRoot')?.appendChild(twoDContainer);
    } else {
        twoDContainer.innerHTML = ''; // Clear previous chart
    }
    const timeScaleToggleContainer = document.getElementById('timeScaleToggleContainer');
    timeScaleToggleContainer.style.display = 'block'; // Show the container

    // 🖼️ Render chart inside the container
    create2DDataVases(
        dataIntervBef,
        dataIntervAft,
        viewParams.colorsBef,
        viewParams.colorsAft,
        viewParams.activeSources,
        selectedSensors,
        viewParams.curLabels,
        'twoDContainer',
        viewParams.currentTimeScale
    );

    console.log("✅ 2D Projection rendered into #twoDContainer.");
}

/**
 * Updates the UI text labels based on the current language settings in viewParams.curLabels.
 * This function assumes that the DOM elements already exist and are language-sensitive.
 */
export async function setLabels() {
    try {

        document.querySelector('.map-mode-toggle-title').textContent = viewParams.curLabels.mapMode;
        document.getElementById('mapModeButtonNoise').textContent = viewParams.curLabels.noiseButton;
        document.getElementById('mapModeButtonSources').textContent = viewParams.curLabels.sourcesButton;

        document.querySelector('.navigation-title').textContent = viewParams.curLabels.navigationTitle;
        document.getElementById('tutorialToggleTitle').textContent = viewParams.curLabels.tutorialToggle;
        
        document.querySelector('#soundSourceContainer .title').textContent = viewParams.curLabels.soundSourcesTitle;
        document.querySelector('label.traffic').lastChild.textContent = viewParams.curLabels.traffic;
        document.querySelector('label.voices').lastChild.textContent = viewParams.curLabels.voices;
        document.querySelector('label.birds').lastChild.textContent = viewParams.curLabels.birds;

        document.querySelector('.period-toggle-title').textContent = viewParams.curLabels.periodToggleTitle;
        document.getElementById('periodButtonBef').textContent = viewParams.curLabels.preLockdown;
        document.getElementById('periodButtonAft').textContent = viewParams.curLabels.lockdown;
        document.getElementById('periodButtonCompare').setAttribute('aria-label', viewParams.curLabels.compare);

        document.querySelector('.view-mode-toggle-title').textContent = viewParams.curLabels.timeScale;
        document.getElementById('timeScaleButtonHour').textContent = viewParams.curLabels.hourOfDay;
        document.getElementById('timeScaleButtonDay').textContent = viewParams.curLabels.dayOfWeek;

        document.getElementById('ctrlRotateTextBox').innerHTML = viewParams.curLabels.rotateTip;

        document.querySelector('.language-toggle-title').textContent = viewParams.curLabels.langage;

        const dropdown = document.getElementById('scenarioDropdown');
        dropdown.options[0].text = viewParams.curLabels.dropdownOption1;
        dropdown.options[1].text = viewParams.curLabels.dropdownOption2;
        dropdown.options[2].text = viewParams.curLabels.dropdownOption3;
    } catch (err) {
        console.warn("Could not load labels.json:", err);
    }
}

/**
 * Switches the interface language to French.
 * - Updates button styles.
 * - Loads French labels.
 * - Updates tutorial content and re-renders data.
 */
export async function switchLangButtonFR() {
    const langButtonFR = document.getElementById('langButtonFR');
    const langButtonENG = document.getElementById('langButtonENG');
    langButtonFR.classList.add('active');
    langButtonFR.classList.remove('inactive');
    langButtonENG.classList.add('inactive');
    langButtonENG.classList.remove('active');
    viewParams.changeCurLabels("fr");
    setLabels();
    const contentContainer = document.querySelector('#tutorialPopup .tutorial-content');
    contentContainer.innerHTML = viewParams.curLabels[viewParams.curTutorialStepAndPage] || "<p>No content available.</p>";
    refreshData();
}

/**
 * Switches the interface language to English.
 * - Updates button styles.
 * - Loads English labels.
 * - Updates tutorial content and re-renders data.
 */
export async function switchLangButtonENG() {
    const langButtonFR = document.getElementById('langButtonFR');
    const langButtonENG = document.getElementById('langButtonENG');
    langButtonFR.classList.add('inactive');
    langButtonFR.classList.remove('active');
    langButtonENG.classList.add('active');
    langButtonENG.classList.remove('inactive');
    viewParams.changeCurLabels("eng");
    setLabels();
    const contentContainer = document.querySelector('#tutorialPopup .tutorial-content');
    contentContainer.innerHTML = viewParams.curLabels[viewParams.curTutorialStepAndPage] || "<p>No content available.</p>";
    refreshData();
}


// ╔════════════════════════════════════════════════════════════════════════╗
// ║ TUTORIAL                                                               ║
// ║                                                                        ║
// ║ This section manages the global behavior and state resets that         ║
// ║ structure the tutorial:                                                ║
// ║   - Interaction locking via `applyInteractionLocks()`                  ║
// ║   - Reset UI & sensor state via `resetDisplay()`                       ║
// ║ These functions are called at the beginning of each tutorial step.     ║
// ╚════════════════════════════════════════════════════════════════════════

function applyInteractionLocks(minZoom = 13, maxZoom = 22) {
    viewParams.min_lat = null;
    viewParams.max_lat = null;
    viewParams.min_lng = null;
    viewParams.max_lng = null;

    deckgl.setProps({
        controller: {
            type: deck.MapController,
            minZoom: minZoom,
            maxZoom: maxZoom,
            scrollZoom: !viewParams.lockZoom,
            doubleClickZoom: !viewParams.lockZoom,
            touchZoom: !viewParams.lockZoom,
            dragPan: !viewParams.lockMove,
            dragRotate: !viewParams.lockTurnView,
            touchRotate: !viewParams.lockTurnView
        }
    });
}

export function resetDisplay() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const periodButtonAft = document.getElementById('periodButtonAft');
    const periodButtonCompare = document.getElementById('periodButtonCompare');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const soundSourceContainer = document.getElementById('soundSourceContainer');
    const timeScaleButtonDay = document.getElementById('timeScaleButtonDay');
    const timeScaleToggleContainer = document.getElementById('timeScaleToggleContainer');
    const timeScaleButtonHour = document.getElementById('timeScaleButtonHour');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'block';
    if (periodToggleContainer) periodToggleContainer.style.display = 'block';
    if (periodButtonCompare) periodButtonCompare.style.display = 'block';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'block';
    if (soundSourceContainer) soundSourceContainer.style.display = 'block';
    if (timeScaleButtonDay) timeScaleButtonDay.style.display = 'block';
    if (timeScaleToggleContainer) timeScaleToggleContainer.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'block';

    if (periodButtonAft) {
        periodButtonAft.click();
    }

    if (timeScaleButtonHour) {
        timeScaleButtonHour.click();
    }

    const dropdown = document.getElementById('scenarioDropdown');
    if (dropdown) {
        dropdown.value = 'lockdown';
        dropdown.dispatchEvent(new Event('change'));
    }

    const trafficCheckbox = document.getElementById('trafficCheckbox');
    const voicesCheckbox = document.getElementById('voicesCheckbox');
    const birdsCheckbox = document.getElementById('birdsCheckbox');

    if (trafficCheckbox && !trafficCheckbox.checked) {
        trafficCheckbox.checked = true;
        trafficCheckbox.dispatchEvent(new Event('change'));
    }

    if (voicesCheckbox && !voicesCheckbox.checked) {
        voicesCheckbox.checked = true;
        voicesCheckbox.dispatchEvent(new Event('change'));
    }

    if (birdsCheckbox && !birdsCheckbox.checked) {
        birdsCheckbox.checked = true;
        birdsCheckbox.dispatchEvent(new Event('change'));
    }

    viewParams.selectedSensors.clear();
    viewParams.resetViewState = INITIAL_VIEW_STATE;
}

export function hideMapModeContainer() {
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const soundSourceContainer = document.getElementById('soundSourceContainer');
    if (mapModeToggleContainer && soundSourceContainer) {
        const mapModeTop = `${parseInt(window.getComputedStyle(mapModeToggleContainer).top, 10) + 10}px`;
        soundSourceContainer.style.top = mapModeTop;
        mapModeToggleContainer.style.display = 'none';
    }
}

export function showMapModeContainer() {
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const soundSourceContainer = document.getElementById('soundSourceContainer');
    if (mapModeToggleContainer && soundSourceContainer) {
        const mapModeTop = window.getComputedStyle(mapModeToggleContainer).top;
        soundSourceContainer.style.top = "500px";
        mapModeToggleContainer.style.display = 'block';
    }
}

// Create smaller buttons to put inside the tutorial text. 
export function makeInlineButton(origButtonId, targetSpanId) {
    const targetSpan = document.getElementById(targetSpanId);
    const original = document.getElementById(origButtonId);
    
    // Put the button in line in text
    if (targetSpan && original) {
        const SCALE = 0.4;
    
        const clone = original.cloneNode(true);
        clone.id = targetSpanId + 'Clone';
        clone.disabled = true;
        clone.classList.remove('inactive');
        clone.style.pointerEvents = 'none';
    
        // Scale the button container
        clone.style.width = `${original.offsetWidth * SCALE}px`;
        clone.style.height = `${original.offsetHeight * SCALE}px`;
        clone.style.display = 'inline-flex';
        clone.style.alignItems = 'center';         // vertical centering
        clone.style.justifyContent = 'center';     // horizontal centering
        clone.style.verticalAlign = 'middle';
        clone.style.margin = '0 4px';
        clone.style.padding = '0';
        clone.style.fontSize = 'inherit';
    
        // ✅ Scale the icon inside the button
        const svg = clone.querySelector('svg');
        if (svg) {
            // Hardcode fallback dimensions if necessary
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
        
            // Or scale explicitly
            svg.style.width = `${24 * (SCALE*1.3)}px`;
            svg.style.height = `${24 * (SCALE*1.3)}px`;
            svg.style.flexShrink = '0'; // if inside a flex container
            svg.style.display = 'block'; // avoid collapsing if inline
        }            
    
        targetSpan.innerHTML = '';
        clone.classList.remove('glow-effect');
        targetSpan.appendChild(clone);
    }
}

export function updateTutorialStepAndPage(step, page, totalPages) {
    resetDisplay();
    refreshData();

    const contentContainer = document.querySelector('#tutorialPopup .tutorial-content');
    const key = `${step}_${page}`;
    viewParams.curTutorialStepAndPage = key;
    contentContainer.innerHTML = viewParams.curLabels[viewParams.curTutorialStepAndPage] || "<p>No content available.</p>";
    const shortStep = step.replace(/^./, '');

    // Update active step button
    const stepButtons = document.querySelectorAll('.step-button');
    stepButtons.forEach((btn) => {
        if (btn.dataset.step === shortStep) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    makeInlineButton('periodButtonCompare', 'inlineModeButtonCompare');
    makeInlineButton('twoDButton', 'inlineTwoDButton');
    makeInlineButton('resetButton', 'inlineResetButton');

    if (shortStep === 'i' && page === 1) {
        tutorialStepi_1Lock();
        resetState();
        updateDisplayData();
    }

    if (shortStep === '1' && page === 1) {
        tutorialStep1_1Lock();
        tutorialStep1_1Zoom();
        updateDisplayData();
    }

    if (shortStep === '1' && page === 2) {
        tutorialStep1_2Lock();
        tutorialStep1_1Zoom();
        tutorialStep1_2Glow();
        updateDisplayData();
    }

    if (shortStep === '1' && page === 3) {
        tutorialStep1_3Lock();
        tutorialStep1_3Zoom();
        updateDisplayData();
    }

    if (shortStep === '1' && page === 4) {
        tutorialStep1_4Lock();
        tutorialStep1_1Zoom();
        updateDisplayData();
    }

    if (shortStep === '2' && page === 1) {
        tutorialStep2_1Lock();
        tutorialStep2_1Zoom();
        tutorialStep2_1Glow();
        updateDisplayData();
    }

    if (shortStep === '2' && page === 2) {
        tutorialStep2_2Lock();
        tutorialStep2_2Glow();
        updateDisplayData();
    }

    if (shortStep === '2' && page === 3) {
        tutorialStep2_3Lock();
        tutorialStep2_1Zoom();
        updateDisplayData();
    }

    if (shortStep === '3' && page === 1) {
        tutorialStep3_1Lock();
        tutorialStep3_1Zoom();
        tutorialStep3_1Glow();
        updateDisplayData();
    }

    if (shortStep === '3' && page === 2) {
        tutorialStep3_2Lock();
        tutorialStep3_2Zoom();
        updateToggleTimeScaleButtonVisibility();
        refreshData();
        updateDisplayData();
    }


    if (shortStep === '3' && page === 3) {
        tutorialStep3_3Lock();
        tutorialStep3_2Zoom();
        viewParams.selectedSensors.clear();
        const sensorsToClick = ["p0720"];
        sensorsToClick.forEach(sensor => viewParams.selectSensor(sensor));
        updateToggleTimeScaleButtonVisibility();
        refreshData();
        tutorialStep3_3Glow();
        updateDisplayData();
    }

    if (shortStep === '3' && page === 4) {
        tutorialStep3_4Lock();
        tutorialStep3_2Zoom();
        viewParams.selectedSensors.clear();
        const sensorsToClick = ["p0720"];
        sensorsToClick.forEach(sensor => viewParams.selectSensor(sensor));
        updateToggleTimeScaleButtonVisibility();
        refreshData();
        tutorialStep3_4Glow();
        updateDisplayData();
    }

    if (shortStep === '3' && page === 5) {
        tutorialStep3_5Lock();
        tutorialStep3_5Zoom();
        viewParams.selectedSensors.clear();
        const sensorsToClick = ["p0720", "p0740"];
        sensorsToClick.forEach(sensor => viewParams.selectSensor(sensor));
        updateToggleTimeScaleButtonVisibility();
        refreshData();
        updateDisplayData();
    }

    if (shortStep === '4' && page === 1) {
        tutorialStep4_1Lock();
        tutorialStep4_1Zoom();
        viewParams.selectedSensors.clear();
        const sensorsToClick = ["p0730", "p0740"];
        sensorsToClick.forEach(sensor => viewParams.selectSensor(sensor));
        updateToggleTimeScaleButtonVisibility();
        refreshData();
        const periodButtonCompare = document.getElementById('periodButtonCompare');
        if (periodButtonCompare) {
            periodButtonCompare.click();
        }
        tutorialStep4_1Glow();
        updateDisplayData();
    }

    if (shortStep === '4' && page === 2) {
        tutorialStep4_2Lock();
        tutorialStep4_1Zoom();
        viewParams.selectedSensors.clear();
        const sensorsToClick = ["p0730", "p0740"];
        sensorsToClick.forEach(sensor => viewParams.selectSensor(sensor));
        updateToggleTimeScaleButtonVisibility();
        refreshData();
        updateDisplayData();
    }

    if (shortStep === '5' && page === 1) {
        const dropdown = document.getElementById('scenarioDropdown');
        if (dropdown) {
            dropdown.value = 'workday';
            dropdown.dispatchEvent(new Event('change'));
        }
        resetState();
        tutorialStep5_1Lock();
        tutorialStep5_1Glow();
        updateDisplayData();
    }

    if (shortStep === '5' && page === 2) {
        const dropdown = document.getElementById('scenarioDropdown');
        if (dropdown) {
            dropdown.value = 'workday';
            dropdown.dispatchEvent(new Event('change'));
        }
        resetState();
        tutorialStep5_2Lock();
        tutorialStep5_2Zoom();
        updateDisplayData();
    }

}

export function applyGlowEffect(elementId, duration = 10000) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.classList.add('glow-effect');

    setTimeout(() => {
        element.classList.remove('glow-effect');
    }, duration);
}

// Function to get the duration for each tutorial step and page.
// Durations are pre-defined, as calculating them dynamically led to 
// errors.
export function getTutorialStepDuration(step, page) {
    const durations = {
        i: { 1: 2000, 2: 500 },
        1: { 1: 2000, 2: 2000, 3: 3000, 4: 2000 },
        2: { 1: 2000, 2: 500, 3: 500 },
        3: { 1: 2000, 2: 1000, 3: 500, 4: 500 },
        4: { 1: 2000, 2: 1000 },
        5: { 1: 2000 }
    };

    return durations[step]?.[page] || 2000; // Default duration if not specified
}

// ════════════════════════════════════════════════════════════════════
// TUTORIAL STEP LOCKS
// These functions define which UI elements are visible and which user 
// interactions (zoom, pan, rotate, etc.) are locked during each tutorial step.
// Called by updateTutorialStepAndPage() to set up each step.
// ════════════════════════════════════════════════════════════════════

export async function tutorialStepi_1Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const soundSourceContainer = document.getElementById('soundSourceContainer');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (soundSourceContainer) soundSourceContainer.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = true;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = [];
    applyInteractionLocks();
}

export async function tutorialStep1_1Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const soundSourceContainer = document.getElementById('soundSourceContainer');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (soundSourceContainer) soundSourceContainer.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = true;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = ["p0720"];
    viewParams.displayedSensors = ["all"];
    applyInteractionLocks();
}

export async function tutorialStep1_2Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = true;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];

    applyInteractionLocks();
}

export async function tutorialStep1_3Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = false;
    viewParams.lockMove = false;
    viewParams.lockTurnView = true;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];

    applyInteractionLocks();
}

export async function tutorialStep1_4Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const soundSourceContainer = document.getElementById('soundSourceContainer');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (soundSourceContainer) soundSourceContainer.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = true;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["p0720", "p0740"];
    applyInteractionLocks();
}

export async function tutorialStep2_1Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const periodButtonCompare = document.getElementById('periodButtonCompare');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (periodButtonCompare) periodButtonCompare.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = true;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["p0720", "p0740"];

    applyInteractionLocks();
}

export async function tutorialStep2_2Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'none';

    viewParams.lockViewStateChange = true;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = true;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["p0720", "p0740"];
    applyInteractionLocks();
}

export async function tutorialStep2_3Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const ctrlRotateTextBox = document.getElementById('ctrlRotateTextBox');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (ctrlRotateTextBox) ctrlRotateTextBox.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = true;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["p0720", "p0740"];

    applyInteractionLocks();
}

export async function tutorialStep3_1Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const timeScaleButtonDay = document.getElementById('timeScaleButtonDay');
    const soundSourceContainer = document.getElementById('soundSourceContainer');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (timeScaleButtonDay) timeScaleButtonDay.style.display = 'none';
    if (soundSourceContainer) soundSourceContainer.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = false;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];
    applyInteractionLocks();
}

export async function tutorialStep3_2Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const timeScaleButtonDay = document.getElementById('timeScaleButtonDay');
    const soundSourceContainer = document.getElementById('soundSourceContainer');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (timeScaleButtonDay) timeScaleButtonDay.style.display = 'none';
    if (soundSourceContainer) soundSourceContainer.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = false;
    viewParams.lockVases = false;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];
    applyInteractionLocks();
}


export async function tutorialStep3_3Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const timeScaleButtonDay = document.getElementById('timeScaleButtonDay');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (timeScaleButtonDay) timeScaleButtonDay.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = false;
    viewParams.lockVases = false;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];

    applyInteractionLocks();
}

export async function tutorialStep3_4Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = false;
    viewParams.lockVases = false;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];

    applyInteractionLocks();
}

export async function tutorialStep3_5Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const periodToggleContainer = document.getElementById('periodToggleContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (periodToggleContainer) periodToggleContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = false;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];
    applyInteractionLocks();
}

export async function tutorialStep4_1Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = false;
    viewParams.lockVases = false;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];

    applyInteractionLocks();
}

export async function tutorialStep4_2Lock() {

    const navigationContainer = document.getElementById('navigationContainer');
    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');

    if (navigationContainer) navigationContainer.style.display = 'none';
    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = true;
    viewParams.lockMove = true;
    viewParams.lockTurnView = false;
    viewParams.lockVases = true;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];
    applyInteractionLocks();
}

export async function tutorialStep5_1Lock() {

    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const timeScaleButtonDay = document.getElementById('timeScaleButtonDay');

    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (timeScaleButtonDay) timeScaleButtonDay.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = false;
    viewParams.lockMove = false;
    viewParams.lockTurnView = false;
    viewParams.lockVases = false;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["all"];

    applyInteractionLocks();
}

export async function tutorialStep5_2Lock() {

    const mapModeToggleContainer = document.getElementById('mapModeToggleContainer');
    const timeScaleButtonDay = document.getElementById('timeScaleButtonDay');

    if (mapModeToggleContainer) mapModeToggleContainer.style.display = 'none';
    if (timeScaleButtonDay) timeScaleButtonDay.style.display = 'none';

    viewParams.lockViewStateChange = false;
    viewParams.lockZoom = false;
    viewParams.lockMove = false;
    viewParams.lockTurnView = false;
    viewParams.lockVases = false;
    viewParams.sensorsSourceLabelDisplayed = [];
    viewParams.displayedSensors = ["p0360", "p0350", "p0330", "p0340", "p0380", "p0300", "p0290", "p0280", "p0270", "p0260", "p0250", "p0240", "p0420", "p0430", "p0440"];

    applyInteractionLocks(16.52875347397696);
}

// ════════════════════════════════════════════════════════════════════
// TUTORIAL STEP ZOOM TRANSITIONS
// Each function defines camera movements (zoom, pan, pitch) used to 
// animate transitions between tutorial steps.
// Called by updateTutorialStepAndPage().
// ════════════════════════════════════════════════════════════════════

export async function tutorialStep1_1Zoom() {

    let STATE_1_1 = {
        latitude: 47.75789984708809,
        longitude: -3.357057071104365,
        zoom: 18.0,
        bearing: 0,
        pitch: 0,
    };

    let STATE_1_2 = {
        latitude: 47.75789984708809,
        longitude: -3.357057071104365,
        zoom: 19.4,
        bearing: 0,
        pitch: 0,
    };

    if (
        (viewParams.curViewState.latitude === STATE_1_1.latitude &&
            viewParams.curViewState.longitude === STATE_1_1.longitude &&
            viewParams.curViewState.zoom === STATE_1_1.zoom) ||
        (viewParams.curViewState.latitude === STATE_1_2.latitude &&
            viewParams.curViewState.longitude === STATE_1_2.longitude &&
            viewParams.curViewState.zoom === STATE_1_2.zoom)
    ) {
        viewParams.lockViewStateChange = true;
        return; // Do nothing if the current view state matches STATE_1_1 or STATE_1_2
    }

    await changeView(STATE_1_1);
    await new Promise(resolve => setTimeout(resolve, 750));
    viewParams.lockViewStateChange = true;
    await changeView(STATE_1_2);
}


export async function tutorialStep1_3Zoom() {

    let STATE_1_1 = {
        latitude: 47.75789984708809,
        longitude: -3.357057071104365,
        zoom: 18,
        bearing: 0,
        pitch: 0,
    };

    let STATE_1_2 = {
        latitude: 47.75789984708809,
        longitude: -3.357057071104365,
        zoom: 16,
        bearing: 0,
        pitch: 0,
    };

    await changeView(STATE_1_1); // Wait for the first changeView to complete

    await new Promise(resolve => setTimeout(resolve, 500));

    setTimeout(async () => {
        await changeView(STATE_1_2); // Wait for the first changeView to complete
    }, 500);
}

export async function tutorialStep2_1Zoom() {

    let STATE_1_1 = {
        latitude: 47.75789984708809,
        longitude: -3.357057071104365,
        zoom: 18.0,
        bearing: 0,
        pitch: 0,
    };

    let STATE_1_2 = {
        latitude: 47.75789984708809,
        longitude: -3.357057071104365,
        zoom: 19.4,
        bearing: 0,
        pitch: 0,
    };

    if (
        (viewParams.curViewState.latitude === STATE_1_1.latitude &&
            viewParams.curViewState.longitude === STATE_1_1.longitude &&
            viewParams.curViewState.zoom === STATE_1_1.zoom) ||
        (viewParams.curViewState.latitude === STATE_1_2.latitude &&
            viewParams.curViewState.longitude === STATE_1_2.longitude &&
            viewParams.curViewState.zoom === STATE_1_2.zoom)
    ) {
        viewParams.lockViewStateChange = true;
        return; // Do nothing if the current view state matches STATE_1_1 or STATE_1_2
    }

    await changeView(STATE_1_1);
    await new Promise(resolve => setTimeout(resolve, 750));
    viewParams.lockViewStateChange = true;
    await changeView(STATE_1_2);
}

export async function tutorialStep3_1Zoom() {

    let STATE_1_1 = {
        latitude: 47.759,
        longitude: -3.3576464318170385,
        zoom: 16.52875347397693,
        bearing: 0,
        pitch: 90,
    };

    let STATE_1_2 = {
        latitude: 47.759,
        longitude: -3.3576464318170385,
        zoom: 16.52875347397693,
        bearing: 0,
        pitch: 90,
    };

    await changeView(STATE_1_1); // Wait for the first changeView to complete
    await new Promise(resolve => setTimeout(resolve, 501));
    await changeView(STATE_1_2); // Wait for the first changeView to complete
}

export async function tutorialStep3_2Zoom() {

    let STATE_1_1 = {
        latitude: 47.7588564342917,
        longitude: -3.356865604692975,
        zoom: 17.881255789961592,
        bearing: 0,
        pitch: 90,
    };

    let STATE_1_2 = {
        latitude: 47.7588564342917,
        longitude: -3.356865604692975,
        zoom: 17.881255789961592,
        bearing: 0,
        pitch: 90,
    };

    await changeView(STATE_1_1); // Wait for the first changeView to complete
    await new Promise(resolve => setTimeout(resolve, 501));
    await changeView(STATE_1_2); // Wait for the first changeView to complete
}


export async function tutorialStep3_5Zoom() {

    let STATE_1_1 = {
        latitude: 47.7588564342917,
        longitude: -3.356865604692975,
        zoom: 17.881255789961592,
        bearing: 0,
        pitch: 90,
    };

    await changeView(STATE_1_1); // Wait for the first changeView to complete
}


export async function tutorialStep4_1Zoom() {

    let STATE_1_1 = {
        latitude: 47.75865184455295,
        longitude: -3.3560607374315157,
        zoom: 17.881255789961596,
        bearing: 0,
        pitch: 90,
    };

    await changeView(STATE_1_1); // Wait for the first changeView to complete
}


export async function tutorialStep5_1Zoom() {

    // ZOOM IN CITY CENTER
    let STATE_1_1 = {
        latitude: 47.747435768040944,
        longitude: -3.364202800908114,
        zoom: 16.52875347397696,
        bearing: 0,
        pitch: 0,
    };

    viewParams.min_lat = 47.746435768040944
    viewParams.max_lat = 47.748435768040944
    viewParams.min_lng = -3.369202800908114
    viewParams.max_lng = -3.360202800908114

    await changeView(STATE_1_1); // Wait for the first changeView to complete
}

export async function tutorialStep5_2Zoom() {

    let STATE_1_1 = {
        latitude: 47.747435768040944,
        longitude: -3.364202800908114,
        zoom: 16.52875347397696,
        bearing: 0,
        pitch: 0,
    };

    viewParams.min_lat = 47.745435768040944
    viewParams.max_lat = 47.749435768040944
    viewParams.min_lng = -3.370202800908114
    viewParams.max_lng = -3.359202800908114

    viewParams.resetViewState = {
        latitude: 47.747435768040944,
        longitude: -3.364202800908114,
        zoom: 16.52875347397696,
        bearing: 0,
        pitch: 0,
    }

    await changeView(STATE_1_1); // Wait for the first changeView to complete
}

// ════════════════════════════════════════════════════════════════════
// TUTORIAL GLOW EFFECTS
// These functions highlight key UI components by applying a glow effect 
// for 10 seconds during specific tutorial steps. They are called from 
// updateTutorialStepAndPage() to guide user attention.
// ════════════════════════════════════════════════════════════════════

export async function tutorialStep1_2Glow() {
    applyGlowEffect('soundSourceContainer', 10000);
}

export async function tutorialStep2_1Glow() {
    applyGlowEffect('periodButtonBef', 10000);
}

export async function tutorialStep2_2Glow() {
    applyGlowEffect('periodButtonCompare', 10000);
}

export async function tutorialStep3_1Glow() {
    applyGlowEffect('ctrlRotateTextBox', 10000);
}

export async function tutorialStep3_3Glow() {
    applyGlowEffect('soundSourceContainer', 10000);
}

export async function tutorialStep3_4Glow() {
    applyGlowEffect('timeScaleButtonDay', 10000);
}

export async function tutorialStep4_1Glow() {
    applyGlowEffect('periodButtonCompare', 10000);
}

export async function tutorialStep5_1Glow() {
    applyGlowEffect('navigationContainer', 10000);
}