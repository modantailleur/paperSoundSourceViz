import { MIN_ZOOM, MAX_ZOOM, NUM_LEVELS, INITIAL_VIEW_STATE } from './config.js';
const { WebMercatorViewport } = deck;

/**
 * Converts a 15-minute interval index into an "HH:mm" formatted time string.
 * Only returns values for specific allowed intervals (e.g. [6, 12, 18]).
 *
 * @param {number} interval - Index from 0 to 95 (96×15min intervals in 24h).
 * @param {number[] | null} allowedIntervals - Optional filter to include only specific times.
 * @returns {string | null} Time in "HH:mm" or null if interval is not allowed.
 */
export function formatTimeTod60min(interval, allowedIntervals = null) {
    if (allowedIntervals && !allowedIntervals.includes(interval)) return null;

    const hours = Math.floor(interval * 60 / 60); // Convert to hours
    const minutes = (interval * 60) % 60; // Convert to minutes
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Converts a day index (0=Mon, 6=Sun) into a localized weekday string.
 * Only returns values for selected days (e.g. [1, 3, 5]).
 *
 * @param {number} interval - Day of week index (0–6).
 * @param {number[]} allowedIntervals - Which days to keep (default [1,3,5]).
 * @param {boolean} shorten - Whether to use shortened day names (e.g. Mon.).
 * @param {string} lang - Language: 'eng' or 'fr'.
 * @returns {string | null} Weekday name or null if not allowed.
 */
export function formatTimeDow(interval, allowedIntervals = [1, 3, 5], shorten=false, lang='eng') {
    if (allowedIntervals && !allowedIntervals.includes(interval)) return null;

    const daysOfWeek = lang === 'eng' 
        ? (shorten 
            ? ['Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.', 'Sun.'] 
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
        : (shorten 
            ? ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'] 
            : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']);
    return daysOfWeek[interval]; // Ensure it wraps around if needed
}

/**
 * Unified time formatter, switching behavior depending on time scale.
 *
 * @param {number} interval - Index (either 0–95 for TOD or 0–6 for DOW).
 * @param {string} timeScale - 'tod' for time-of-day or 'dow' for day-of-week.
 * @param {string} lang - 'eng' or 'fr' for localization.
 * @param {number[] | null} allowedIntervals - Optional whitelist.
 * @param {boolean} shorten - If true, returns abbreviated names.
 * @returns {string | null}
 */
export function formatTime(interval, timeScale='tod', lang='eng', allowedIntervals=null, shorten=false) {
    if (timeScale === 'tod') {
        return formatTimeTod60min(interval, allowedIntervals);
    } else if (timeScale === 'dow') {
        return formatTimeDow(interval, allowedIntervals, shorten, lang);
    }
}

/**
 * Retrieves localized labels for before/after comparisons based on scenario.
 *
 * @param {Object} labels - Localization object containing scenario label strings.
 * @returns {Object} A mapping from scenario → { bef, aft } labels.
 */
export function getPeriodLabel(labels) {
    return {
        lockdown: {
            bef: labels.preLockdown,
            aft: labels.lockdown
        },
        daynight: {
            bef: labels.day,
            aft: labels.night
        },
        workday: {
            bef: labels.workday,
            aft: labels.saturday
        }
    };
}

/**
 * Scales a Deck.gl viewState by a zoom scaling factor.
 *
 * @param {number} scalingFactor - Zoom multiplier.
 * @param {Object} viewState - Deck.gl viewState object.
 * @returns {Object} Modified viewState with scaled zoom.
 */
export function scaleZoomView(scalingFactor, viewState) {
    return {
        ...viewState,
        zoom: viewState.zoom * scalingFactor
    };
}

/**
 * Computes rose glyph size in meters based on zoom level and screen area.
 * Follows McNabb et al. (2018) recommendation: glyphs should occupy ~2.5% of screen.
 // McNabb, L.; Laramee, R.S.; Wilson, M. When Size Matters - Towards Evaluating Pereivability of
// Choropleths. The Computer Graphics & Visual Computing (CGVC) Conference 2018; The Eurographics
// Association, , 2018; pp. 163–171. doi:10.2312/cgvc.20181221.
 * @param {number} zoom - Current map zoom level.
 * @param {number} latitude - Viewport center latitude.
 * @param {number} longitude - Viewport center longitude.
 * @returns {number} Radius in meters for rose glyph at given zoom.
 */
export const computeRoseSizeMeters = (zoom, latitude = 0, longitude = 0) => {
    // We consider that about 40% of the screen is taken by the map, considering all
    // the other elements that are on the screen (tutorial popup, legend, etc.)
    const uiRoot = document.getElementById('uiRoot');
    const { width, height } = uiRoot.getBoundingClientRect();
    const screenAreaPixels = (50 / 100) * width * (80 / 100) * height;
    const desiredPixelArea = screenAreaPixels * 0.025; // 2.5% of screen area
    const radiusPixels = Math.sqrt(desiredPixelArea / Math.PI); // radius in pixels

    const viewport = new WebMercatorViewport({ width, height, latitude, longitude, zoom });
    const metersPerPixel = viewport.metersPerPixel;
    return metersPerPixel * radiusPixels;
};

/**
 * Converts a continuous zoom value into a discrete zoom level index.
 *
 * @param {number} zoom - Raw zoom level (e.g., 12.5).
 * @returns {number} Rounded zoom level index (e.g., 0–4 if NUM_LEVELS=5).
 */
export const zoomToZoomLevel = (zoom) => {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const scaled = ((clampedZoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * (NUM_LEVELS - 1);
    return Math.round(scaled);
};

/**
 * Precomputes a mapping from discrete zoom levels to rose glyph radius (in meters).
 * This ensures consistent glyph sizing at each zoom level.
 */
export const zoomLevelToRosesSize = Object.fromEntries(
    Array.from({ length: NUM_LEVELS }, (_, level) => {
        const zoom = MIN_ZOOM + (level / (NUM_LEVELS - 1)) * (MAX_ZOOM - MIN_ZOOM);
        return [level, computeRoseSizeMeters(zoom, INITIAL_VIEW_STATE.latitude, INITIAL_VIEW_STATE.longitude)];
    })
);