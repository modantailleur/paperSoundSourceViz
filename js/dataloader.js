/**
 * Loads preprocessed soundscape data from a given JSON file.
 * @param {string} jsonFilePath - Path to the JSON file containing processed soundscape data.
 * @returns {Promise<Array>} - Processed data array.
 */

import { DATA_PATH } from './config.js';

export async function loadDataInterv(intervType, startTime, endTime, periodOfDay = undefined, periodOfWeek = undefined) {
    try {
        let fileName;

        if (intervType === "tod") {
            fileName = `soundscape_data_tod_start_${startTime}_end_${endTime}`;
        } else {
            fileName = `soundscape_data_dow_start_${startTime}_end_${endTime}`;
        }

        if (periodOfDay !== undefined) {
            fileName += `_${periodOfDay}`;
        }

        if (periodOfWeek !== undefined) {
            fileName += `_${periodOfWeek}`;
        }

        const jsonFilePath = `${DATA_PATH}/json/${fileName}.json`;

        const response = await fetch(jsonFilePath);
        const jsonData = await response.json();

        return Object.keys(jsonData).flatMap(sensorName => {
            const sensorData = jsonData[sensorName];

            if (!sensorData.presence || sensorData.presence.length === 0) {
                return [];
            }

            return sensorData.location.flatMap(loc => 
                sensorData.presence.map(d => ({
                    sensor: sensorName,
                    latitude: loc.lat,
                    longitude: loc.long,
                    interval: d.interval,
                    laeq: d.laeq,
                    leq: d.leq,
                    t: d.t,
                    v: d.v,
                    b: d.b
                }))
            );
        });

    } catch (error) {
        console.error(`Error loading JSON from ${jsonFilePath}:`, error);
        return [];
    }
}

export async function loadDataAVG(startTime, endTime, periodOfDay = undefined, periodOfWeek = undefined) {
    try {
        let fileName = `soundscape_data_avg_start_${startTime}_end_${endTime}`;

        if (periodOfDay !== undefined) {
            fileName += `_${periodOfDay}`;
        }

        if (periodOfWeek !== undefined) {
            fileName += `_${periodOfWeek}`;
        }

        const response = await fetch(`${DATA_PATH}/json/${fileName}.json`);
        const jsonData = await response.json();

        const processedData = Object.keys(jsonData).flatMap(sensorName => {
            const sensorData = jsonData[sensorName];

            if (!sensorData.presence) {
                return [];
            }

            const location = sensorData.location[0] || {};
            const latitude = location.lat || null;
            const longitude = location.long || null;

            const { leq, laeq, t, v, b } = sensorData.presence;

            return [{
                sensor: sensorName,
                latitude,
                longitude,
                leq,
                laeq,
                t,
                v,
                b
            }];
        });

        return processedData;

    } catch (error) {
        console.error('Error loading or parsing JSON:', error);
        return [];
    }
}
