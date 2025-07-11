import { INITIAL_VIEW_STATE, TVB_COLORS, TVB_COLORS_TRANSPARENT, SELECTED_SENSORS_LIMIT, LAN,
    INIT_SCENARIO, INIT_PERIOD, INIT_TIME_SCALE, INIT_COMPARE_MODE,
 } from './config.js';
import KMeans from './kmeans.js';
import { labels } from './labels.js';
import { zoomLevelToRosesSize, zoomToZoomLevel } from './utils.js';

const CACHE_DIR = './cache';

// Main state management class for view configuration
export class ViewParameters {
    constructor() {
        // View and rendering state
        this.curViewState = INITIAL_VIEW_STATE; // current view state, modified at every view state change
        this.zoomLevel = zoomToZoomLevel(this.curViewState.zoom) // transform the zoom into a discrete zoom level
        this.rosesRadius = zoomLevelToRosesSize[this.zoomLevel] // radius of the roses in meters, depending on the zoom level

        // UI state
        this.currentTimeScale = INIT_TIME_SCALE; // Default to Time of Day
        this.compareMode = INIT_COMPARE_MODE; 
        this.scenario = INIT_SCENARIO; // Default to lockdown
        this.period = INIT_PERIOD
        this.activeSources = {
            t: true,
            v: true,
            b: true,
            laeq: false,
            leq: false
        };

        // Sensor selection and filtering
        this.selectedSensors = new Set(); // Track selected sensors
        this.selectedSensorsLimit = SELECTED_SENSORS_LIMIT; // Limit for selected sensors
        this.filteredOutSensors = new Set(); // Sensors in this list are not displayed
        this.filteredInSensors = new Set(); // Sensors in this list are displayed

        // Data storage
        this.data = null; // Store the data globally
        this.scenarioData = null; // Store the data globally
        this.scenarioDataSimple = null; // Store the data globally
        this.scenarioDataCompare = null; // Store the data globally

        // Color settings for scenarios
        this.colorsBef = TVB_COLORS_TRANSPARENT;
        this.colorsAft = TVB_COLORS;

        // Labels and language settings
        this.labels = labels;
        this.lan = LAN;
        this.curLabels = this.labels[this.lan];

        // Glyph overlap and aggregation data by zoom level
        this.overlapData = {};
        this.overlapHiddenCountsMap = {};

        // Tutorial and interaction locks
        this.lockViewStateChange = false;
        this.lockVases = false;
        this.lockZoom = false;
        this.lockMove = false;
        this.lockTurnView = false;
        this.sensorsSourceLabelDisplayed = [];
        this.displayedSensors = ["all"];
        this.resetViewState = INITIAL_VIEW_STATE;

        // Optional bounding box to restrict movement
        this.min_lat = null;
        this.max_lat = null;
        this.min_lng = null;
        this.max_lng = null;

    }

    /**
     * Initialize internal data structures for all zoom levels and scenarios.
     */
    async initialize(data, save=true) {
        if (save) {
            this.data = data;
        }
        
        this.overlapData = {};
        this.overlapHiddenCountsMap = {};
        const filterdInSensorsByPeriod = {};

        for (const [zoomLevel, roseRadius] of Object.entries(zoomLevelToRosesSize)) {
            this.overlapData[zoomLevel] = {};
            this.overlapHiddenCountsMap[zoomLevel] = {};

            for (const [periodKey, periodData] of Object.entries(data)) {
                const filterName = `${periodKey}_${zoomLevel}`;

                const { filteredOutSensors, filteredInSensors, hiddenCountsMap } = await filterOverlappingRosesGreedy(
                    periodData?.dataAVGBef,
                    roseRadius,
                    filterdInSensorsByPeriod[periodKey],
                    filterName
                );

                filterdInSensorsByPeriod[periodKey] = filteredInSensors;

                // Kmeans version
                // const { filteredOutSensors, filteredInSensors, hiddenCountsMap } = await filterOverlappingRosesKmeans(
                //     periodData?.dataAVGBef,
                //     zoomLevel,
                //     filterName
                // );

                this.overlapData[zoomLevel][periodKey] = {
                    ...periodData
                };
                this.overlapHiddenCountsMap[zoomLevel][periodKey] = hiddenCountsMap;

                for (const [key, value] of Object.entries(periodData)) {
                    if (Array.isArray(value)) {
                        this.overlapData[zoomLevel][periodKey][key] = value.filter(sensor =>
                            filteredInSensors.includes(sensor.sensor)
                        );
                    }
                }
            }
        }

        this.filterData();
    }

    /**
     * Return the currently filtered data for rendering.
     */
    getFilteredDataParameters(zoomLevel = undefined) {
        const currentZoomLevel = zoomLevel !== undefined ? zoomLevel : this.zoomLevel;
        const periodDataCompare = this.overlapData[currentZoomLevel][this.scenario];
        const hiddenCountsMap = this.overlapHiddenCountsMap[currentZoomLevel][this.scenario];
    
        let periodDataSimple;
    
        if (this.period === "bef") {
            periodDataSimple = {
                ...periodDataCompare,
                dataAVGAft: undefined,
                dataTodAft: undefined,
                dataDowAft: undefined,
            };
        } else if (this.period === "aft") {
            periodDataSimple = {
                ...periodDataCompare,
                dataAVGBef: undefined,
                dataTodBef: undefined,
                dataDowBef: undefined,
            };
        }
    
        const periodData = this.compareMode ? periodDataCompare : periodDataSimple;
    
        return {
            periodDataCompare,
            periodDataSimple,
            periodData,
            hiddenCountsMap
        };
    }

    /**
     * Update internal scenario data based on current zoom and period/compare settings.
     */
    filterData(zoomLevel = undefined) {
        const filtered = this.getFilteredDataParameters(zoomLevel);
        this.scenarioDataCompare = filtered.periodDataCompare;
        this.scenarioDataSimple = filtered.periodDataSimple;
        this.scenarioData = filtered.periodData;
        this.hiddenCountsMap = filtered.hiddenCountsMap;
    }

    /**
     * When zoom changes, recompute zoom level and glyph radius, then filter data.
     */
    resetDataFromZoom(zoom) {
        this.zoomLevel = zoomToZoomLevel(zoom)
        this.rosesRadius = zoomLevelToRosesSize[this.zoomLevel];
        this.filterData();
    }

    /**
     * Switch between comparison mode and single-period mode.
     */
    switchCompareParameters(isChecked) {
        this.compareMode = isChecked; // ✅ Toggle based on checkbox state
        this.scenarioData = isChecked ? this.scenarioDataCompare : this.scenarioDataSimple;
    }

    /**
     * Toggle noise map mode (LAeq) and update source visibility accordingly.
     */
    switchNoiseMapModeParameters(isChecked) {
        this.activeSources.laeq = isChecked;
        this.switchTrafficParameters(!isChecked);
        this.switchVoicesParameters(!isChecked);
        this.switchBirdsParameters(!isChecked);
    }

    /**
     * Toggle between time-of-day (tod) and day-of-week (dow) display.
     */
    switchTimeScaleParameters() {
        if (!this.scenarioData) {
            console.error("❌ Data is not loaded yet!");
            return;
        }

        this.currentTimeScale = this.currentTimeScale === 'tod' ? 'dow' : 'tod';
        console.log(`🔄 Switching to ${this.currentTimeScale}`);
    }

    /**
     * Switch scenario and update labels accordingly.
     */
    switchScenarioParameters(period) {
        if (period === "lockdown") {
            this.scenario = "lockdown";
            this.textButtonBef = this.curLabels.preLockdown;
            this.textButtonAft = this.curLabels.lockdown;
        } else if (period === "daynight") {
            this.scenario = "daynight";
            this.textButtonBef = this.curLabels.day;
            this.textButtonAft = this.curLabels.night;
        } else if (period === "workday") {
            this.scenario = "workday";
            this.textButtonBef = this.curLabels.workday;
            this.textButtonAft = this.curLabels.saturday;
        } else {
            this.scenario = "none";
        }
    }

    // Toggle each source type independently
    switchTrafficParameters(isChecked) {
        this.activeSources.t = isChecked;
    }

    switchVoicesParameters(isChecked) {
        this.activeSources.v = isChecked;
    }

    switchBirdsParameters(isChecked) {
        this.activeSources.b = isChecked
    }

    switchLaeqParameters(isChecked) {
        this.activeSources.laeq = isChecked;
    }

    switchLeqParameters(isChecked) {
        this.activeSources.leq = isChecked;
    }

    /**
     * Disable all sources.
     */
    resetActiveSources() {
        Object.keys(this.activeSources).forEach(key => {
            this.activeSources[key] = false;
        });
        console.log("All active sources have been reset:", this.activeSources);
    }

    /**
     * Add/remove a sensor from the selection set.
     * Enforces max selection limit by removing oldest item.
     */
    selectSensor(sensor) {
        if (this.selectedSensors.has(sensor)) {
            this.selectedSensors.delete(sensor);
        } else {
            this.selectedSensors.add(sensor);
        }

        if (this.selectedSensors.size > this.selectedSensorsLimit) {
            const firstSensor = this.selectedSensors.values().next().value;
            this.selectedSensors.delete(firstSensor);
        }

        console.log(this.selectedSensors)
        console.log("Selected sensors:", Array.from(this.selectedSensors));
    }

    /**
     * Change UI labels language.
     */
    changeCurLabels(lan) {
        this.lan = lan;
        this.curLabels = this.labels[this.lan];

        console.log('Current labels:', this.curLabels);
        console.log('lan:', this.lan);
        this.switchScenarioParameters(this.scenario);
    }
}

/**
 * Clears cached KMeans filtering results from both:
 * - Cache Storage API (if used)
 * - LocalStorage (main storage used here)
 *
 * @param {string} filterName - Identifier used for the cache key.
 */
async function clearCache(filterName) {
    const cacheName = 'kmeans-cache';
    const cacheKey = `filterCache-${filterName}`;

    // 🔥 Clear Cache Storage API
    try {
        const cache = await caches.open(cacheName);
        const cacheCleared = await cache.delete(cacheKey); // Remove specific cache entry
        if (cacheCleared) {
            console.log(`✅ Successfully deleted cache entry from Cache Storage: ${cacheKey}`);
        } else {
            console.log(`❌ No cache entry found for: ${cacheKey} in Cache Storage`);
        }
    } catch (error) {
        console.error(`❌ Failed to clear Cache Storage: ${error.message}`);
    }

    // 🔥 Clear LocalStorage
    try {
        localStorage.removeItem(cacheKey);
        console.log(`✅ Successfully cleared LocalStorage for key: ${cacheKey}`);
    } catch (error) {
        console.error(`❌ Failed to clear LocalStorage: ${error.message}`);
    }
}

/**
 * Downloads a cached KMeans filtering result from LocalStorage as a .json file.
 *
 * @param {string} filterName - Identifier used for the cache key and file name.
 */
function downloadCache(filterName) {
    const cacheKey = `filterCache-${filterName}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (!cachedData) {
        console.error(`No cached data found for ${filterName}`);
        return;
    }

    // Convert data to a Blob and trigger download
    const blob = new Blob([cachedData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${filterName}_cache.json`;
    a.click();

    // Clean up URL object after download
    URL.revokeObjectURL(url);
    console.log(`📁 Cache for ${filterName} downloaded successfully`);
}

/**
 * UNUSED FUNCTION
 * Filters overlapping roses (sensor glyphs) using KMeans clustering.
 * One representative sensor per cluster is kept; others are hidden.
 *
 * @param {Array} dataArray - Array of sensor data with latitude/longitude.
 * @param {number} zoomLevel - Current zoom level (discretized).
 * @param {string} filterName - Unique name used for caching the result.
 * @param {boolean} doClearCache - If true, clear cache before computing.
 * @param {boolean} doDownloadCache - If true, trigger download of cached data.
 * @returns {Object} An object containing:
 *                   - filteredInSensors: IDs of visible sensors,
 *                   - filteredOutSensors: IDs of hidden sensors,
 *                   - hiddenCountsMap: count of hidden sensors per visible one.
 */
export async function filterOverlappingRosesKmeans(dataArray, zoomLevel, filterName, doClearCache = false, doDownloadCache = false) {

    // Clear cache if doClearCache is true
    if (doClearCache) {
        await clearCache(filterName);
    }

    // Download cache if doDownloadCache is true
    if (doDownloadCache) {
        downloadCache(filterName);
    }

    const cacheKey = `filterCache-${filterName}`;
    const cacheFilePath = `${CACHE_DIR}/${filterName}_cache.json`;

    // 🔍 Check if cache exists as a JSON file in ./cache/
    try {
        const response = await fetch(cacheFilePath);
        if (response.ok) {
            const cachedData = await response.json();
            console.log(`📂 Loaded cached result from file: ${cacheFilePath}`);
            return cachedData;
        }
    } catch (error) {
        console.log(`File cache miss: ${cacheFilePath}. Proceeding to check LocalStorage...`);
    }

    // 🔍 Check if cache exists in LocalStorage
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
        console.log(`📂 Loaded cached result from LocalStorage for ${filterName}`);
        return JSON.parse(cachedData);
    }

    console.log(`Cache miss: ${filterName}. Proceeding to run KMeans clustering...`);

    const offsetCoeff = 0.6;
    if (!dataArray || dataArray.length === 0) return { filteredOutSensors: [], filteredInSensors: [], hiddenCountsMap: {} };

    const clusterSizes = {0: 1, 1: 2, 2: 9, 3: 18, 4: 24};
    const numClusters = clusterSizes[zoomLevel] || 8;

    const dataPoints = dataArray.map(d => [d.latitude, d.longitude]);

    const kmeans = new KMeans({
        k: numClusters,
        data: dataPoints,
        maxIterations: 10000,
        verbose: false,
    });

    const clusters = await new Promise((resolve, reject) => {
        kmeans.run((result) => {
            if (result && result.data) {
                resolve(result.data);
            } else {
                reject(new Error("KMeans result is invalid"));
            }
        });
    });

    const sensorsByCluster = new Map();
    dataArray.forEach((sensorData, index) => {
        const clusterIndex = clusters[index];
        if (!sensorsByCluster.has(clusterIndex)) {
            sensorsByCluster.set(clusterIndex, []);
        }
        sensorsByCluster.get(clusterIndex).push(sensorData);
    });

    const sensorsToKeep = new Set();
    const hiddenCountsMap = {};

    for (const [clusterIndex, sensorGroup] of sensorsByCluster.entries()) {
        const centroid = kmeans.centroids[clusterIndex];
        let bestSensor = sensorGroup[0];
        let minDistance = Infinity;

        for (const sensor of sensorGroup) {
            const distance = Math.sqrt(
                Math.pow(sensor.latitude - centroid[0], 2) + Math.pow(sensor.longitude - centroid[1], 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                bestSensor = sensor;
            }
        }

        const chosenSensor = bestSensor.sensor;
        sensorsToKeep.add(chosenSensor);

        const hiddenCount = sensorGroup.length;
        if (hiddenCount > 1) {
            hiddenCountsMap[chosenSensor] = hiddenCount;
        }
    }

    const allSensors = dataArray.map(d => d.sensor);
    const filteredOutSensors = allSensors.filter(sensor => !sensorsToKeep.has(sensor));
    const filteredInSensors = Array.from(sensorsToKeep);

    const result = { filteredOutSensors, filteredInSensors, hiddenCountsMap };

    // ✅ Save the result to LocalStorage
    try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
        console.log(`✅ Cached result saved to LocalStorage for ${filterName}`);
    } catch (error) {
        console.error(`Failed to save cache: ${error.message}`);
    }

    return result;
}


/**
 * Greedy algorithm to filter overlapping rose glyphs (sensor circles) on the map.
 * It returns a subset of non-overlapping glyphs and builds a map of how many others are hidden behind each.
 *
 * @param {Array} dataArray - Array of sensor objects with lat/lon positions.
 * @param {number} radius - Radius in meters of each rose glyph.
 * @param {Set|null} curPresentSensors - Sensors that are already displayed (to avoid overlap with them).
 * @returns {Object} filteredOutSensors, filteredInSensors, hiddenCountsMap
 */
export async function filterOverlappingRosesGreedy(dataArray, radius = 0.00025, curPresentSensors = null) {
    const offsetCoeff = 1.0;
    if (!dataArray || dataArray.length === 0) return { filteredOutSensors: [], filteredInSensors: [], hiddenCountsMap: {} };

    const sensorBounds = dataArray.map(d => ({
        sensor: d.sensor,
        lat: d.latitude,
        lon: d.longitude,
        maxRadiusLat: offsetCoeff * radius / 111320,
        maxRadiusLon: offsetCoeff * radius / (111320 * Math.cos(d.latitude * (Math.PI / 180))),
        radius: radius
    }));

    // Step 1: Build intersectMatrix
    const intersectMatrix = {};
    for (let i = 0; i < sensorBounds.length; i++) {
        const a = sensorBounds[i];
        intersectMatrix[a.sensor] = {};
        for (let j = 0; j < sensorBounds.length; j++) {
            if (i === j) continue;
            const b = sensorBounds[j];
            if (isOverlapping(a, b, offsetCoeff)) {
                const area = calculateIntersectionArea(a, b);
                if (area > 0) {
                    intersectMatrix[a.sensor][b.sensor] = area;
                }
            }
        }
    }

    // Step 2: Initialize filteredInSensors (exclude overlaps with curPresentSensors if any)
    let filteredInSensors = sensorBounds.map(s => s.sensor);
    if (curPresentSensors) {
        filteredInSensors = filteredInSensors.filter(sensor => {
            const overlaps = curPresentSensors.some(p => intersectMatrix[sensor]?.[p] || intersectMatrix[p]?.[sensor]);
            return !overlaps;
        });
    }

    // Step 3: Greedy filtering
    const selected = [];

    while (filteredInSensors.length > 0) {
        // Compute total intersection area for each sensor in filteredInSensors
        const totalIntersectionArea = {};
        for (const s of filteredInSensors) {
            totalIntersectionArea[s] = 0;
            for (const other of filteredInSensors) {
                if (s !== other) {
                    totalIntersectionArea[s] += intersectMatrix[s]?.[other] || 0;
                }
            }
        }

        // Pick the sensor with the maximum total intersection area
        let maxSensor = null;
        let maxArea = -1;
        for (const s of filteredInSensors) {
            if (totalIntersectionArea[s] > maxArea) {
                maxSensor = s;
                maxArea = totalIntersectionArea[s];
            }
        }

        if (!maxSensor || maxArea === 0) break; // Stop if no more overlaps

        selected.push(maxSensor);

        // Remove from filteredInSensors all sensors that intersect with maxSensor
        filteredInSensors = filteredInSensors.filter(s =>
            s === maxSensor || !(intersectMatrix[maxSensor]?.[s] || intersectMatrix[s]?.[maxSensor])
        );
    }

    // Remaining sensors are kept
    const finalFilteredInSensors = filteredInSensors;
    const filteredOutSensors = sensorBounds.map(s => s.sensor).filter(s => !finalFilteredInSensors.includes(s));

    // Step 4: Build hiddenCountsMap using best visible sensor per hidden one
    const hiddenCountsMap = {};
    const hiddenToBestVisible = {};

    for (const visible of finalFilteredInSensors) {
        for (const hidden of filteredOutSensors) {
            const area = intersectMatrix[visible]?.[hidden] || intersectMatrix[hidden]?.[visible] || 0;
            if (area > 0) {
                if (!hiddenToBestVisible[hidden] || area > hiddenToBestVisible[hidden].area) {
                    hiddenToBestVisible[hidden] = { visible, area };
                }
            }
        }
    }

    for (const hidden in hiddenToBestVisible) {
        const { visible } = hiddenToBestVisible[hidden];
        hiddenCountsMap[visible] = (hiddenCountsMap[visible] || 0) + 1;
    }

    // Add +1 for the visible glyph itself
    for (const key in hiddenCountsMap) {
        hiddenCountsMap[key] += 1;
    }

    return {
        filteredOutSensors,
        filteredInSensors: finalFilteredInSensors,
        hiddenCountsMap
    };
}

function isOverlapping(a, b, offsetCoeff = 1.0) {
    const latDiff = (a.lat - b.lat) * 111320;
    const lonDiff = (a.lon - b.lon) * 111320 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
    const dist = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
    return dist <= (a.radius + b.radius) * offsetCoeff;
}

function calculateIntersectionArea(a, b) {
    const d = Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lon - b.lon, 2));
    if (d >= a.radius + b.radius) return 0;
    if (d <= Math.abs(a.radius - b.radius)) return Math.PI * Math.pow(Math.min(a.radius, b.radius), 2);

    const r1 = a.radius;
    const r2 = b.radius;

    const part1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
    const part2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
    const part3 = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));

    return part1 + part2 - part3;
}