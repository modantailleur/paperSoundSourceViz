// Default language
export const LAN = "eng"; 

// Default map view settings
export const INIT_SCENARIO = "lockdown"; 
export const INIT_PERIOD = "bef";
export const INIT_TIME_SCALE = "tod";
export const INIT_COMPARE_MODE = false;
export const SELECTED_SENSORS_LIMIT = 3;

// Default zoom settings
export const MIN_ZOOM = 12;
export const MAX_ZOOM = 20;
export const NUM_LEVELS = 100;

export const INITIAL_VIEW_STATE = {
    latitude: 47.75169859756313,
    longitude: -3.3604204607664396,
    zoom: 14.5,
    bearing: 0,
    pitch: 0,
};

// Colors found in evaluation (in find_colors folder)
export const TVB_COLORS = {
    t: [254, 0, 0, 255], // [R, G, B, A]
    v: [255, 204, 1, 255], // [R, G, B, A]
    b: [82, 151, 88, 255], // [R, G, B, A]
    laeq: [186, 85, 211, 255],    // Lighter Purple
    leq: [186, 85, 211, 255],    // Lighter Purple
};

// TVB colors but with adjusted luminance at 150% of the original luminance. Computed with:
// https://www.peko-step.com/en/tool/hslrgb_en.html
export const TVB_COLORS_TRANSPARENT = {
    t: [224, 122, 122, 255],
    v: [255, 227, 127, 255],
    b: [149, 197, 153, 255],
    laeq: [213, 154, 228, 255],
    leq: [213, 154, 228, 255],
};

 // Radius of the Earth in meters
export const EARTH_RADIUS_METERS = 6378137;

// Define DATA_PATH 
export let DATA_PATH = "./data/";

/**
 * Dynamically Check If `/data/` Exists
 * If not, switch to `./data_light/`.
 */
export async function checkDataPath() {
    try {
        const testFile = `${DATA_PATH}/init.txt`; // Pick a known file
        const response = await fetch(testFile, { method: 'HEAD' }); // Lightweight check
        if (!response.ok) throw new Error("Data not found"); // If not OK, switch
    } catch (error) {
        console.warn("⚠️ Switching to backup data path: ./data_light/");
        DATA_PATH = "./data_light/"; // Set fallback
    }
}

