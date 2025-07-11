import {formatTime} from './utils.js';
import { EARTH_RADIUS_METERS } from './config.js';

/**
 * Draws a 2D bar chart comparing `dataIntervBef` and `dataIntervAft` for each sensor.
 * If only one of them is defined, it draws bars symmetrically.
 * If both are defined, it places before on the left and after on the right.
 *
 * @param {Array} dataIntervBef
 * @param {Array} dataIntervAft
 * @param {Object} colorsBef - { t: '#color', v: '#color', b: '#color' }
 * @param {Object} colorsAft - same as above
 * @param {Object} activeSources - { t: true, v: true, b: true }
 * @param {Set|Array} selectedSensors
 * @param {string} containerId - HTML container ID to attach canvas
 */
export function create2DDataVases(
    dataIntervBef,
    dataIntervAft,
    colorsBef,
    colorsAft,
    activeSources,
    selectedSensors,
    labels, 
    containerId = 'twoDContainer',
    timeScale = 'tod'
) {

    const sensors = Array.isArray(selectedSensors) ? selectedSensors : Array.from(selectedSensors);

    const oldCanvas = document.getElementById('barCompareCanvas');
    if (oldCanvas) oldCanvas.remove();

    const container = document.getElementById(containerId) || document.body;
    const containerWidth = container.clientWidth || 1000;
    const containerHeight = container.clientHeight || 500;

    const canvas = document.createElement('canvas');
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    canvas.id = 'barCompareCanvas';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    const minFontSize = 20;
    const maxFontSize = 30;
    const adaptiveFontSize = Math.max(
        minFontSize,
        Math.min(maxFontSize, Math.min(containerWidth, containerHeight) / 25)
    );
    ctx.font = `${adaptiveFontSize}px sans-serif`;

    const rgba = arr =>
        arr.length === 4
            ? `rgba(${arr[0]}, ${arr[1]}, ${arr[2]}, ${arr[3] / 255})`
            : `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})`;

    let totalIntervals, timeScaleFunc, allowedIntervals, shorten;
    if (timeScale === 'tod') {
        totalIntervals = 24;
        allowedIntervals = [0, 4, 8, 12, 16, 20];
        shorten = true;
        timeScaleFunc = i => formatTime(i, timeScale, labels.lang, allowedIntervals, shorten);
    } else if (timeScale === 'dow') {
        totalIntervals = 7;
        allowedIntervals = [0, 1, 2, 3, 4, 5, 6];
        shorten = true;
        timeScaleFunc = i => formatTime(i, timeScale, labels.lang, allowedIntervals, shorten);
    } else {
        const maxBef = Math.max(...(dataIntervBef?.map(d => d.interval ?? 0) || [0]));
        const maxAft = Math.max(...(dataIntervAft?.map(d => d.interval ?? 0) || [0]));
        totalIntervals = Math.max(maxBef, maxAft) + 1;
        timeScaleFunc = i => `Interval ${i}`;
    }

    const groupedData = {};
    const process = (data, suffix) => {
        data?.forEach(d => {
            const key = `${d.sensor}-${d.interval}`;
            if (!groupedData[key]) groupedData[key] = { interval: d.interval, sensor: d.sensor };
            for (let attr in activeSources) {
                if (activeSources[attr] && d[attr] != null) {
                    groupedData[key][`${attr}${suffix}`] = d[attr];
                }
            }
        });
    };

    process(dataIntervBef, 'Bef');
    process(dataIntervAft, 'Aft');

    const records = [];
    for (const sensor of sensors) {
        for (let i = 0; i < totalIntervals; i++) {
            const key = `${sensor}-${i}`;
            const base = groupedData[key] || { interval: i, sensor };
            records.push(base);
        }
    }

    const marginLeft = 70;
    const margin = 20;
    const bottomMargin = 50;

    const defaultBarGap = (dataIntervAft && dataIntervBef) ? 2 : 0;

    const maxValue = Math.max(
        ...records.flatMap(d =>
            Object.keys(activeSources)
                .flatMap(attr => [`${attr}Bef`, `${attr}Aft`])
                .map(k => d[k] || 0)
        )
    );

    const totalSensors = sensors.length;

    const spacingRatio = 0.001;
    const minSpacing = 1;
    const maxSpacing = 3;
    const barSpacing = Math.round(Math.max(minSpacing, Math.min(maxSpacing, containerHeight * spacingRatio)));

    const totalBarsHeight = canvas.height - margin - bottomMargin - barSpacing * (totalIntervals - 1);
    const barHeight = Math.floor(totalBarsHeight / totalIntervals);

    const availableWidth = canvas.width - marginLeft - margin;
    const sensorSpacing = availableWidth / totalSensors;
    const maxAllowedBarLength = 80;
    const maxBarLength = Math.min(sensorSpacing * 0.4, maxAllowedBarLength);
    const dynamicScale = maxBarLength / ((dataIntervAft && dataIntervBef) ? 1 : 0.5);

    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const labelOffsetX = 5;

    for (let i = 0; i < totalIntervals; i++) {
        const label = timeScaleFunc(i);
        if (label == null || label === 'null') continue;
        const y = Math.round(canvas.height - bottomMargin - i * (barHeight + barSpacing) - barHeight / 2);
        ctx.fillText(label, labelOffsetX, y);
    }

    // === HORIZONTAL GUIDES WITH GAP AROUND VERTICAL LINES ===

    ctx.save();
    const dash = 6;
    const horizLineGap = 10; // px gap around vertical lines
    ctx.setLineDash([dash, dash * 1.5]);
    ctx.strokeStyle = '#ddd'; // Light grey
    ctx.lineWidth = 2;
    
    for (let i = 0; i < totalIntervals; i++) {
        const label = timeScaleFunc(i);
        if (label == null || label === 'null') continue;
    
        const y = Math.round(canvas.height - bottomMargin - i * (barHeight + barSpacing) - barHeight / 2);
    
        // Build full horizontal dashed line by drawing allowed segments across all sensors
        let xCursor = marginLeft;
    
        for (const sensor of sensors) {
            const centerX = Math.round(xCursor + sensorSpacing / 2);
    
            const offset = (dataIntervAft && dataIntervBef)
                ? defaultBarGap + Math.round(1 * dynamicScale)
                : defaultBarGap + Math.round(1 * dynamicScale / 2);
    
            const gap = horizLineGap;
    
            // Position breakdown
            const x0 = xCursor;
            const x1 = centerX - offset - gap;      // before first vertical line
            const x2 = centerX - offset + gap;      // after first vertical line
            const x3 = centerX - gap;               // before bar center
            const x4 = centerX + gap;               // after bar center
            const x5 = centerX + offset - gap;      // before second vertical line
            const x6 = centerX + offset + gap;      // after second vertical line
            const x7 = xCursor + sensorSpacing;     // end of sensor slot
    
            const segments = [
                [x0, x1],
                [x2, x3],
                [x4, x5],
                [x6, x7]
            ];
    
            segments.forEach(([startX, endX], segmentIndex) => {
                const isFirstSensor = sensor === sensors[0];
                const isSkippedSegment = isFirstSensor
                    ? (segmentIndex === 2 || segmentIndex === 3)
                    : (segmentIndex === 2 || segmentIndex === 3);
            
                if (!isSkippedSegment && endX > startX) {
                    ctx.beginPath();
                    ctx.moveTo(startX, y);
                    ctx.lineTo(endX, y);
                    ctx.stroke();
                }
            });
    
            xCursor += sensorSpacing;
        }
    }
    
    ctx.restore();

    // === DRAW BARS AND VERTICAL LINES ===
    let x = marginLeft;

    for (const sensor of sensors) {
        const sensorRecords = records
            .filter(d => d.sensor === sensor)
            .sort((a, b) => a.interval - b.interval);

        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText(sensor, Math.round(x + sensorSpacing / 2), canvas.height - Math.floor(bottomMargin / 2));

        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        const centerX = Math.round(x + sensorSpacing / 2);
        const drawGuides = offset => {
            const lineX = centerX + offset;
            ctx.beginPath();
            ctx.moveTo(lineX, margin);
            ctx.lineTo(lineX, canvas.height - bottomMargin);
            ctx.stroke();
        };
        if (dataIntervAft && dataIntervBef) {
            drawGuides(-defaultBarGap - Math.round(1 * dynamicScale));
            drawGuides(defaultBarGap + Math.round(1 * dynamicScale));
        } else {
            drawGuides(-defaultBarGap - Math.round(1 * dynamicScale / 2));
            drawGuides(defaultBarGap + Math.round(1 * dynamicScale / 2));
        }

        ctx.restore();

        let yBase = Math.round(canvas.height - bottomMargin - barHeight);
        let tallestBarY = Infinity;

        for (const rec of sensorRecords) {
            const drawMaxBar = (rec, suffix, colorSet, direction) => {
                const values = Object.keys(activeSources)
                    .filter(attr => activeSources[attr])
                    .map(attr => ({
                        attr,
                        value: rec[`${attr}${suffix}`]
                    }))
                    .filter(v => v.value != null);

                if (values.length === 0) return;

                const maxVal = Math.max(...values.map(v => v.value));
                const maxAttr = values.find(v => v.value === maxVal).attr;
                const len = Math.round(maxVal * dynamicScale);

                const color = colorSet[maxAttr];
                if (!color) return;

                ctx.fillStyle = rgba(color);

                const centerX = Math.round(x + sensorSpacing / 2);
                const yPos = Math.round(yBase);
                tallestBarY = Math.min(tallestBarY, yPos);

                if (direction === 'left') {
                    ctx.fillRect(centerX - defaultBarGap - len, yPos, len, barHeight);
                } else if (direction === 'right') {
                    ctx.fillRect(centerX + defaultBarGap, yPos, len, barHeight);
                } else {
                    ctx.fillRect(centerX - Math.floor(len / 2), yPos, len, barHeight);
                }
            };

            if (dataIntervAft && dataIntervBef) {
                drawMaxBar(rec, 'Bef', colorsBef, 'left');
                drawMaxBar(rec, 'Aft', colorsAft, 'right');
            } else if (dataIntervBef) {
                drawMaxBar(rec, 'Bef', colorsBef, 'center');
            } else if (dataIntervAft) {
                drawMaxBar(rec, 'Aft', colorsAft, 'center');
            }

            yBase = Math.round(yBase - (barHeight + barSpacing));
        }

        const arrowX = Math.round(x + sensorSpacing / 2);
        const arrowStartY = tallestBarY;
        const shaftLength = 20;
        const arrowTipY = arrowStartY - shaftLength;

        ctx.strokeStyle = 'black';
        ctx.fillStyle = 'black';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowStartY);
        ctx.lineTo(arrowX, arrowTipY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(arrowX - 5, arrowTipY + 6);
        ctx.lineTo(arrowX + 5, arrowTipY + 6);
        ctx.lineTo(arrowX, arrowTipY);
        ctx.closePath();
        ctx.fill();

        x += sensorSpacing;
    }
}

/**
 * Generates 3D data vases for each sensor, with each time interval split into two half-cylinders.
 * If `dataAft` is undefined, draws a full circle only for `dataBef`.
 * @param {Array} dataIntervBef - Data for the before period.
 * @param {Array} dataIntervAft - Data for the after period (optional).
 * @param {Array} dataAvg - Data used for the rose diagram.
 * @returns {Array} - An array of DeckGL PolygonLayers for visualization.
 */
export function createdataVases(
    dataAVGBef,
    dataIntervBef,
    colorsBef,
    dataAVGAft,
    dataIntervAft,
    colorsAft,
    activeSources,
    labels,
    timeScale = 'tod',
    maxRadius = 100,
    period = undefined,
    hiddenCountsMap = {},
  ) {
    const vaseHeight = 4.8 * maxRadius;
    const gapsizeMeters = 0.1 * maxRadius;
    const textSizeMeters = 0.35 * maxRadius;
    const numCurvePoints = 15;
    const colors = { colorsBef, colorsAft };
  
    const groupedData = groupSensorData(dataIntervBef, dataIntervAft, activeSources);
    
    console.log('Grouped Data:', groupedData);

    let sectionHeight, shorten, allowedIntervals;
    let timeScaleFunc = undefined;
    if (timeScale === 'tod') {
      sectionHeight = vaseHeight / 24;
      allowedIntervals = [4, 8, 12, 16, 20];
      shorten = true;
      timeScaleFunc = i => formatTime(i, timeScale, labels.lang, allowedIntervals, shorten);
    } else if (timeScale === 'dow') {
      sectionHeight = vaseHeight / 7;
      shorten = true;
      allowedIntervals = [0, 1, 2, 3, 4, 5, 6];
      timeScaleFunc = i => formatTime(i, timeScale, labels.lang, allowedIntervals, shorten);
    } else {
      const maxSections = Math.max(...Object.values(groupedData).map(sensor => sensor.sections.length));
      sectionHeight = vaseHeight / maxSections;
    }
  
    const vaseLayers = Object.values(groupedData).flatMap(sensor => {
      sensor.sections.sort((a, b) => a.interval - b.interval);
  
      const columns = sensor.sections.flatMap(values => {
        const elevation = values.interval * sectionHeight;
        return generateVaseSections(
          sensor,
          values,
          elevation,
          sectionHeight,
          maxRadius,
          colors,
          numCurvePoints,
          dataIntervBef,
          dataIntervAft,
          activeSources,
          timeScaleFunc,
          gapsizeMeters,
          textSizeMeters,
          period
        );
      });
  
      const roseOnTop = createRoseDiagrams(
        dataAVGBef,
        colorsBef,
        dataAVGAft,
        colorsAft,
        activeSources,
        labels,
        vaseHeight * 1.1,
        maxRadius,
        hiddenCountsMap,
      );
  
      return [...columns, roseOnTop];
    });
  
    // Add arrow above the last column layer
    const arrowLayer = createArrowAboveLayer(groupedData, vaseHeight);

    return arrowLayer ? [...vaseLayers, arrowLayer] : vaseLayers;
  }

function createArrowAboveLayer(groupedData, vaseHeight) {
    const sensorKeys = Object.keys(groupedData);
    if (sensorKeys.length === 0) return null;

    const lastSensorKey = sensorKeys[sensorKeys.length - 1];
    const sensorData = groupedData[lastSensorKey];
    if (!sensorData || !sensorData.sections.length) return null;

    const baseElevation = vaseHeight;
    const lat = sensorData.latitude;
    const lon = sensorData.longitude;

    const shaftHeight = vaseHeight / 25; // height of the arrow shaft
    const shaftRadius = shaftHeight/15;
    const headBaseRadius = shaftHeight/4; // wider than the shaft
    const headHeight = shaftHeight/3;
    const headLayers = 5;
    const headColor = [0, 0, 0, 255];

    const layers = [];

    // Shaft
    layers.push(new deck.ColumnLayer({
        id: `arrow-shaft-${sensorData.sensor}`,
        data: [{
        position: [lon, lat, baseElevation]
        }],
        getPosition: d => d.position,
        radius: shaftRadius,
        diskResolution: 12,
        elevationScale: 1,
        getElevation: () => shaftHeight,
        getFillColor: headColor,
        extruded: true,
        pickable: false
    }));

    // Arrowhead: layered cone-like structure
    for (let i = 0; i < headLayers; i++) {
        const radius = headBaseRadius * (1 - i / headLayers); // tapering
        const segmentHeight = headHeight / headLayers;
        const z = baseElevation + shaftHeight + i * segmentHeight;

        layers.push(new deck.ColumnLayer({
        id: `arrow-head-${sensorData.sensor}-segment-${i}`,
        data: [{
            position: [lon, lat, z]
        }],
        getPosition: d => d.position,
        radius,
        diskResolution: 12,
        elevationScale: 1,
        getElevation: () => segmentHeight,
        getFillColor: headColor,
        extruded: true,
        pickable: false
        }));
    }

    return layers;
}

/**
 * Groups sensor data for before and after periods.
 * @param {Array} dataIntervBef - Data for before period.
 * @param {Array} dataIntervAft - Data for after period.
 * @returns {Object} - Grouped sensor data.
 */
function groupSensorData(dataIntervBef, dataIntervAft, activeSources) {
    const groupedData = {};

    const processData = (data, suffix) => {
        data.forEach(d => {
            const key = `${d.sensor}-${d.latitude.toFixed(5)}-${d.longitude.toFixed(5)}`;
            if (!groupedData[key]) {
                groupedData[key] = {
                    sensor: d.sensor,
                    latitude: d.latitude,
                    longitude: d.longitude,
                    sections: []
                };
            }
            const section = groupedData[key].sections.find(s => s.interval === d.interval);
            if (section) {
                Object.keys(d).forEach(attr => {
                    if (activeSources[attr]) {
                        section[attr + suffix] = d[attr];
                    }
                });
            } else {
                const newSection = { interval: d.interval };
                Object.keys(d).forEach(attr => {
                    if (activeSources[attr]) {
                        newSection[attr + suffix] = d[attr];
                    }
                });
                groupedData[key].sections.push(newSection);
            }
        });
    };

    if (dataIntervBef) {
        processData(dataIntervBef, 'Bef');
    }

    if (dataIntervAft) {
        processData(dataIntervAft, 'Aft');
    }

    return groupedData;
}

function generateVaseSections(
    sensor,
    values,
    elevation,
    sectionHeight,
    maxRadius,
    colors,
    numCurvePoints,
    hasBeforeData,
    hasAfterData,
    activeSources,
    timeScaleFunc = undefined,
    gapSizeMeters = 10,
    textSizeMeters = 20,
) {
    const sourcesBef = {};
    const sourcesAft = {};

    Object.keys(activeSources).forEach(attr => {
        if (activeSources[attr]) {
            sourcesBef[attr] = values[`${attr}Bef`] || 0;
            sourcesAft[attr] = values[`${attr}Aft`] || 0;
        }
    });

    const { interval = 0 } = values;

    const [radiusBef, colorBef] = getScaledRadiusAndColor(sourcesBef, maxRadius, colors.colorsBef, activeSources);
    const [radiusAft, colorAft] = getScaledRadiusAndColor(sourcesAft, maxRadius, colors.colorsAft, activeSources);

    // Decide who gets the label
    let showLabelFor = null;
    if (!hasBeforeData && hasAfterData) {
        showLabelFor = 'aft';
    } else if (hasBeforeData && !hasAfterData) {
        showLabelFor = 'bef';
    } else if (hasBeforeData && hasAfterData) {
        showLabelFor = (radiusAft >= radiusBef) ? 'aft' : 'bef';
    }

    const createLayer = (radius, color, startAngle, endAngle, isBefore, showText) =>
        createColumnLayer(
            sensor,
            radius,
            elevation,
            sectionHeight,
            color,
            numCurvePoints,
            !hasBeforeData || !hasAfterData,
            startAngle,
            endAngle,
            timeScaleFunc,
            -gapSizeMeters,
            showText ? textSizeMeters : 0,
            interval,
            isBefore,
            Math.max(radiusAft, radiusBef)
        );

    if (!hasAfterData) {
        return [createLayer(radiusBef, colorBef, 0, 2 * Math.PI, true, true)];
    }

    if (!hasBeforeData) {
        return [createLayer(radiusAft, colorAft, 0, 2 * Math.PI, false, true)];
    }

    return [
        createLayer(radiusBef, colorBef, Math.PI / 2, (3 * Math.PI) / 2, true, showLabelFor === 'bef'),
        createLayer(radiusAft, colorAft, -Math.PI / 2, Math.PI / 2, false, showLabelFor === 'aft')
    ];
}

/**
 * Computes the dominant value, scales the radius, and assigns color.
 */
function getScaledRadiusAndColor(sources, maxRadius, colors, activeSources) {
    // Filter sources based on activeSources
    const filteredSources = Object.entries(sources)
        .filter(([key, value]) => activeSources[key] && value > 0)
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});

        if (Object.keys(filteredSources).length === 0) {
        return [0, [0, 0, 0, 0]]; // No active sources, return zero radius and transparent color
    }

    const values = Object.values(filteredSources);
    const maxVal = Math.max(...values);
    const scaledRadius = maxVal * maxRadius;

    const dominantSource = Object.keys(filteredSources)[values.indexOf(maxVal)];
    const dominantColor = colors[dominantSource];

    return [scaledRadius, dominantColor];
}

function createColumnLayer(
    sensor,
    radius,
    elevation,
    sectionHeight,
    color,
    numCurvePoints,
    isFullCircle,
    startAngle = 0,
    endAngle = 2 * Math.PI,
    timeScaleFunc = undefined,
    gapSizeMeters = 0,
    textSizeMeters = 0,
    interval = undefined,
    isBefore = undefined,
    labelRadius = radius
) {
    const polygon = isFullCircle
        ? generateCircle(sensor.longitude, sensor.latitude, radius, elevation, numCurvePoints)
        : generateHalfCircle(sensor.longitude, sensor.latitude, radius, startAngle, endAngle, elevation, gapSizeMeters, numCurvePoints);

    const polygonLayer = new deck.PolygonLayer({
        id: `data-vases-layer-${sensor.sensor}-${Math.random()}`,
        data: [{
            sensor: sensor.sensor,
            polygon,
            color: color,
            interval: interval,
            isBefore: isBefore
        }],
        getPolygon: d => d.polygon,
        getFillColor: d => d.color,
        extruded: true,
        elevationScale: 1,
        getElevation: () => sectionHeight,
        pickable: true,
        material: { ambient: 0.50, diffuse: 0, shininess: 0 },
        wireframe: false // we draw the wireframe manually
    });

    // === Manual Wireframe Layer ===
    const wireframeSegments = [];
    const basePolygon = polygon;
    const topPolygon = polygon.map(([lon, lat]) => [lon, lat, elevation + sectionHeight]);
    const basePolygon3D = basePolygon.map(([lon, lat]) => [lon, lat, elevation]);

    for (let i = 0; i < basePolygon.length; i++) {
        wireframeSegments.push({
            source: basePolygon3D[i],
            target: topPolygon[i]
        });
    }

    for (let i = 0; i < topPolygon.length; i++) {
        wireframeSegments.push({
            source: topPolygon[i],
            target: topPolygon[(i + 1) % topPolygon.length]
        });
    }

    for (let i = 0; i < basePolygon.length; i++) {
        wireframeSegments.push({
            source: basePolygon3D[i],
            target: basePolygon3D[(i + 1) % basePolygon.length]
        });
    }


    const wireframeLayer = new deck.LineLayer({
        id: `wireframe-lines-${sensor.sensor}-${Math.random()}`,
        data: wireframeSegments,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: [0, 0, 0, 255],
        widthUnits: 'meters',
        getWidth: -gapSizeMeters/7,
        parameters: {
            depthTest: true
        },
        pickable: false
    });

    let dashedLineLayer = null;
    let textLayer = null;

    if (textSizeMeters > 0) {
        const intervalLabel = timeScaleFunc ? timeScaleFunc(interval) : undefined;

        if (intervalLabel) {
            const radiusInMeters = labelRadius + 0.1 * textSizeMeters;
            const degPerMeter = 180 / (Math.PI * 6371000);
            const radiusInDegreesLat = radiusInMeters * degPerMeter;
            const radiusInDegreesLon = (radiusInMeters * degPerMeter) / Math.cos(sensor.latitude * Math.PI / 180);

            const gapInMeters = textSizeMeters * 3;
            const lineWidth = textSizeMeters / 30;
            const textOffsetInMeters = textSizeMeters * 2;
            const gapInDegreesLon = (gapInMeters * degPerMeter) / Math.cos(sensor.latitude * Math.PI / 180);
            const textOffsetInDegreesLon = (textOffsetInMeters * degPerMeter) / Math.cos(sensor.latitude * Math.PI / 180);

            const z = elevation + sectionHeight / 2;

            const lineStart = [
                sensor.longitude - radiusInDegreesLon,
                sensor.latitude,
                z
            ];

            const lineEnd = [
                sensor.longitude - gapInDegreesLon,
                sensor.latitude,
                z
            ];

            const textPos = [
                sensor.longitude - gapInDegreesLon - textOffsetInDegreesLon,
                sensor.latitude,
                z
            ];

            const dashSegments = generateDashedLineSegments(lineStart, lineEnd, textSizeMeters * 0.5, textSizeMeters * 0.75);

            dashedLineLayer = new deck.LineLayer({
                id: `legend-line-${sensor.sensor}-${Math.random()}`,
                data: dashSegments,
                getSourcePosition: d => d.source,
                getTargetPosition: d => d.target,
                getColor: [0, 0, 0, 255],
                widthUnits: 'meters',
                getWidth: lineWidth,
                pickable: false,
                parameters: {
                    depthTest: false
                }
            });

            textLayer = new deck.TextLayer({
                id: `legend-text-${sensor.sensor}-${Math.random()}`,
                data: [{
                    sensor: sensor.sensor,
                    text: intervalLabel,
                    position: textPos,
                    color: [0, 0, 0, 255]
                }],
                getText: d => d.text,
                getPosition: d => d.position,
                getColor: d => d.color,
                getSize: () => textSizeMeters,
                sizeUnits: 'meters',
                getAngle: 0,
                billboard: false,
                fontFamily: 'Montserrat',
            });

            return [wireframeLayer, dashedLineLayer, textLayer, polygonLayer];
        }
    }

    return [wireframeLayer, polygonLayer];
}


function generateDashedLineSegments(start, end, dashLengthMeters, gapLengthMeters) {
    const EARTH_RADIUS = 6371000;
    const degPerMeter = 180 / (Math.PI * EARTH_RADIUS);
    const latFactor = 1;
    const lonFactor = 1 / Math.cos((start[1] + end[1]) / 2 * Math.PI / 180);

    const dx = (end[0] - start[0]) / degPerMeter * lonFactor;
    const dy = (end[1] - start[1]) / degPerMeter * latFactor;
    const dz = end[2] - start[2];
    const totalLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const ux = dx / totalLength;
    const uy = dy / totalLength;
    const uz = dz / totalLength;

    const segments = [];
    let pos = 0;

    while (pos < totalLength) {
        const dashStart = pos;
        const dashEnd = Math.min(pos + dashLengthMeters, totalLength);

        const sx = start[0] + (dashStart * ux * degPerMeter / lonFactor);
        const sy = start[1] + (dashStart * uy * degPerMeter / latFactor);
        const sz = start[2] + dashStart * uz;

        const ex = start[0] + (dashEnd * ux * degPerMeter / lonFactor);
        const ey = start[1] + (dashEnd * uy * degPerMeter / latFactor);
        const ez = start[2] + dashEnd * uz;

        segments.push({ source: [sx, sy, sz], target: [ex, ey, ez] });

        pos += dashLengthMeters + gapLengthMeters;
    }

    return segments;
}

/**
 * Generates a full circular polygon.
 */
function generateCircle(centerLon, centerLat, radiusMeters, elevation, numCurvePoints) {
    const arcPoints = generateArcPoints(centerLon, centerLat, radiusMeters, elevation, 0, 2 * Math.PI, numCurvePoints);

    return arcPoints; 
}

/**
 * Generates a half-circle polygon with an optional offset to create a visual gap.
 * @param {number} centerLon - Longitude of the center point.
 * @param {number} centerLat - Latitude of the center point.
 * @param {number} radiusMeters - Radius of the half-circle in meters.
 * @param {number} startAngle - Start angle of the half-circle (radians).
 * @param {number} endAngle - End angle of the half-circle (radians).
 * @param {number} elevation - Elevation of the polygon.
 * @param {number} offsetFactor - Offset to separate halves of the cylinder.
 * @param {number} numCurvePoints - Number of points for smoothness.
 * @returns {Array} - Polygon coordinates for the half-circle.
 */
function generateHalfCircle(centerLon, centerLat, radiusMeters, startAngle, endAngle, elevation, gapSizeMeters, numCurvePoints = 15) {
    const EARTH_RADIUS_METERS = 6371000;
    const gapSize = (gapSizeMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const radiusDegreesLat = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const latitudeRadians = centerLat * (Math.PI / 180);
    const radiusDegreesLon = radiusDegreesLat / Math.cos(latitudeRadians);

    // Offset: Bottom polygons shift left, top polygons shift right
    const lonOffset = (startAngle === -Math.PI / 2) ? -gapSize : gapSize;

    const arcPoints = Array.from({ length: numCurvePoints + 1 }, (_, j) => {
        const interpAngle = startAngle + (endAngle - startAngle) * (j / numCurvePoints);
        return [
            centerLon + lonOffset + radiusDegreesLon * Math.cos(interpAngle),
            centerLat + radiusDegreesLat * Math.sin(interpAngle),
            elevation
        ];
    });

    return [[centerLon + lonOffset, centerLat, elevation], ...arcPoints, [centerLon + lonOffset, centerLat, elevation]];
}

/**
 * Generates arc points for a given circle/half-circle.
 */
function generateArcPoints(centerLon, centerLat, radiusMeters, elevation, startAngle, endAngle, numCurvePoints) {
    const EARTH_RADIUS_METERS = 6371000;
    const radiusDegreesLat = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const latitudeRadians = centerLat * (Math.PI / 180);
    const radiusDegreesLon = radiusDegreesLat / Math.cos(latitudeRadians);

    return Array.from({ length: numCurvePoints + 1 }, (_, j) => {
        const interpAngle = startAngle + (endAngle - startAngle) * (j / numCurvePoints);
        return [centerLon + radiusDegreesLon * Math.cos(interpAngle), centerLat + radiusDegreesLat * Math.sin(interpAngle), elevation];
    });
}

export function generateRoseData(
    sensorData,
    colors,
    fill = true,
    maxRadiusMeters = 35,
    numCurvePoints = 15,
    elevation = 0,
    activeSources,
    isBefore = false,
    isHalfCircle = false,
    gapSizeMeters = 20
) {

    const maxRadius = maxRadiusMeters / 111320; // meters -> degrees (roughly)
    const gapSize = gapSizeMeters / 111320;

    return sensorData.flatMap(sensor => {
        const { latitude, longitude } = sensor;
        const values = [];
        const sources = [];

        Object.keys(activeSources).forEach(key => {
            if (activeSources[key]) {
                if (!isBefore && isHalfCircle) {
                    values.unshift(sensor[key]);
                    sources.unshift(key);
                } else {
                    values.push(sensor[key]);
                    sources.push(key);
                }
            }
        });

        if (values.length === 0) return [];

        const scaledValues = values.map(v => Math.sqrt(v) * maxRadius);
        const numSlices = values.length;
        const latitudeRadians = latitude * (Math.PI / 180);
        const baseLongitude = !isHalfCircle
            ? longitude
            : isBefore === false
            ? longitude + gapSize
            : isBefore === true
            ? longitude - gapSize
            : longitude;

        const maxRadiusLat = Math.max(...scaledValues);
        const maxRadiusLon = Math.max(...scaledValues.map(radius => radius / Math.cos(latitudeRadians)));

        if (numSlices === 1 && isHalfCircle === false) {
            const radius = scaledValues[0];
            const radiusLng = radius / Math.cos(latitudeRadians);

            const arcPoints = Array.from({ length: numCurvePoints + 1 }, (_, j) => {
                const interpAngle = j * (2 * Math.PI / numCurvePoints);
                return [
                    baseLongitude + radiusLng * Math.cos(interpAngle),
                    latitude + radius * Math.sin(interpAngle),
                    elevation
                ];
            });

            return [{
                polygon: [...arcPoints, arcPoints[0]],
                color: colors[sources[0]],
                sensor: sensor.sensor,
                fill: fill,
                lat: latitude,
                lon: baseLongitude,
                maxRadiusLat: maxRadiusLat,
                maxRadiusLon: maxRadiusLon,
                sourceKey: sources[0],
                minAngle: 0,
                maxAngle: 2 * Math.PI,
                radius: radius,         // ✅ radius (for center calculation)
                radiusLng: radiusLng,   // ✅ radius in longitude (for center calculation)
                isBefore: isBefore // Fix: Handle isBefore properly
            }];
        }

        // Offset slices to align the first divider with North
        const angleOffset = (numSlices % 3 === 0) ? (Math.PI / (2 * numSlices)) : 0;

        const angles = isHalfCircle === false
            ? [...Array(numSlices + 1).keys()].map(i => (i * (2 * Math.PI)) / numSlices + angleOffset)
            : !isBefore
                ? [...Array(numSlices + 1).keys()].map(i => (i * Math.PI) / numSlices - Math.PI / 2)
                : [...Array(numSlices + 1).keys()].map(i => (i * Math.PI) / numSlices + Math.PI / 2);

        return values.map((value, i) => {
            const startAngle = angles[i];
            const endAngle = angles[i + 1];
            const radius = scaledValues[i];
            const radiusLng = radius / Math.cos(latitudeRadians);

            const arcPoints = Array.from({ length: numCurvePoints + 1 }, (_, j) => {
                const interpAngle = startAngle + (endAngle - startAngle) * (j / numCurvePoints);
                return [
                    baseLongitude + radiusLng * Math.cos(interpAngle),
                    latitude + radius * Math.sin(interpAngle),
                    elevation
                ];
            });

            return {
                polygon: [[baseLongitude, latitude, elevation], ...arcPoints, [baseLongitude, latitude, elevation]],
                color: colors[sources[i]],
                sensor: sensor.sensor,
                fill: fill,
                lat: latitude,
                lon: baseLongitude,
                maxRadiusLat: maxRadiusLat,
                maxRadiusLon: maxRadiusLon,
                sourceKey: sources[i],   // ✅ source key (important for grouping)
                minAngle: startAngle,     // ✅ starting angle (for center calculation)
                maxAngle: endAngle,       // ✅ ending angle (for center calculation)
                radius: radius,         // ✅ radius (for center calculation)
                radiusLng: radiusLng,   // ✅ radius in longitude (for center calculation)
                isBefore: isBefore // Fix: Handle isBefore properly
            };
        });
    });
}

export function createRoseDiagrams(
    dataBef,
    colorsBef,
    dataAft,
    colorsAft,
    activeSources,
    labels, 
    elevation = 0,
    maxRadiusMeters = 20,
    hiddenCountsMap = {},
    sensorsSourceLabelDisplayed = [] 
) {
    const numCurvePoints = 15;
    const gapSizeMeters = 0.1 * maxRadiusMeters;
    const lineWidthMeters = 0.02 * maxRadiusMeters;
    const textLineWidthMeters = 0.02 * maxRadiusMeters;
    const textLineLengthMeters = 1.1 * maxRadiusMeters;
    const textSizeMeters = maxRadiusMeters / 5;
    const badgeRadiusMeters = textSizeMeters * 1.4;
    const textCenterPositionCoeff = 0.95;

    // --- Helper layers --- //

    const createCircleBadgeLayer = (id, data) =>
        new deck.ScatterplotLayer({
            id,
            data: data.filter(d => hiddenCountsMap[d.sensor] !== undefined),
            getPosition: d => [
                d.lon + textCenterPositionCoeff * d.maxRadiusLon,
                d.lat + textCenterPositionCoeff * d.maxRadiusLat,
                elevation,
            ],
            getFillColor: [0, 0, 0],
            getRadius: () => badgeRadiusMeters,
            radiusUnits: 'meters',
            pickable: false,
        });

    const createTextBadgeLayer = (id, data) => {
        const uniqueSensors = new Set();
        const filteredData = data.filter(d => {
            if (hiddenCountsMap[d.sensor] !== undefined && !uniqueSensors.has(d.sensor)) {
                uniqueSensors.add(d.sensor);
                return true;
            }
            return false;
        });
        
        // The following lines are pretty weird,
        // as they are not supposed to work. But duplicating
        // the text layers allow for it to be more white and
        // less grey.
        const duplicatedData = [];
        filteredData.forEach(d => {
            for (let i = 0; i < 3; i++) {
            duplicatedData.push({ ...d });
            }
        });

        return new deck.TextLayer({
            id,
            data: duplicatedData,
            pickable: false,
            getPosition: d => [
                d.lon + textCenterPositionCoeff * d.maxRadiusLon,
                d.lat + textCenterPositionCoeff * d.maxRadiusLat,
                elevation + 0.01,
            ],
            getText: d => hiddenCountsMap[d.sensor]?.toString() || '',
            getSize: () => textSizeMeters,
            sizeUnits: 'meters',
            getColor: [255, 255, 255],
            background: false,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            billboard: false,
            fontFamily: 'Montserrat',
        });
    };

    const createMaxRadiusCircleLayer = (id, data, radiusMeters) => {
        const segments = 64;
        const dashedSegments = [];

        data.forEach(d => {
            const cx = d.lon;
            const cy = d.lat;
            const latRad = (cy * Math.PI) / 180;
            const deltaLat = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
            const deltaLon = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI) / Math.cos(latRad);

            for (let i = 0; i < segments; i++) {
                if (i % 2 === 0) {
                    const angle1 = (i / segments) * 2 * Math.PI;
                    const angle2 = ((i + 1) / segments) * 2 * Math.PI;

                    dashedSegments.push({
                        path: [
                            [
                                cx + deltaLon * Math.cos(angle1),
                                cy + deltaLat * Math.sin(angle1),
                                elevation + 0.005,
                            ],
                            [
                                cx + deltaLon * Math.cos(angle2),
                                cy + deltaLat * Math.sin(angle2),
                                elevation + 0.005,
                            ]
                        ]
                    });
                }
            }
        });

        return new deck.PathLayer({
            id,
            data: dashedSegments,
            getPath: d => d.path,
            getColor: [0, 0, 0],
            getWidth: lineWidthMeters / 2,
            widthUnits: 'meters',
            pickable: false,
        });
    };

    const createSourceLinesLayer = (id, data, textLineLengthMeters, elevation = 0, sensorsSourceLabelDisplayed = true) => {
        const filteredData = data.filter(d => sensorsSourceLabelDisplayed.includes(d.sensor));
        if (filteredData.length === 0) return null;

        const lines = [];

        const groups = {};
        filteredData.forEach(d => {
            const key = d.sensor + '-' + d.sourceKey;
            if (!groups[key]) groups[key] = [];
            groups[key].push(d);
        });

        Object.values(groups).forEach(group => {
            const d = group[0];
            const centerLon = d.lon;
            const centerLat = d.lat;
            const latitudeRadians = centerLat * (Math.PI / 180);
            const endLat = (textLineLengthMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
            const endLon = (textLineLengthMeters / EARTH_RADIUS_METERS) * (180 / Math.PI) / Math.cos(latitudeRadians);
            const startLat = (d.radius / 2); 
            const startLon = (d.radiusLng / 2);

            const minAngle = Math.min(...group.map(d => d.minAngle));
            const maxAngle = Math.max(...group.map(d => d.maxAngle));
            const centerAngle = (minAngle + maxAngle) / 2;

            lines.push({
                path: [
                    [
                        centerLon + startLon * Math.cos(centerAngle),
                        centerLat + startLat * Math.sin(centerAngle),
                        elevation + 0.01,
                    ],
                    [
                        centerLon + endLon * Math.cos(centerAngle),
                        centerLat + endLat * Math.sin(centerAngle),
                        elevation + 0.01,
                    ]
                ]
            });
        });

        return new deck.PathLayer({
            id,
            data: lines,
            getPath: d => d.path,
            getColor: [0, 0, 0],
            getWidth: textLineWidthMeters,
            widthUnits: 'meters',
            pickable: false,
        });
    };

    const createSourceLabelsLayer = (id, data, textLineLengthMeters, labels, elevation = 0, sensorsSourceLabelDisplayed = true) => {
        const filteredData = data.filter(d => sensorsSourceLabelDisplayed.includes(d.sensor));
        if (filteredData.length === 0) return null;

        const baseLabelOffsetMeters = textSizeMeters * 0.25; // base distance
    
        const curLabels = [];
    
        const groups = {};
        filteredData.forEach(d => {
            const key = d.sensor + '-' + d.sourceKey;
            if (!groups[key]) groups[key] = [];
            groups[key].push(d);
        });
    
        Object.values(groups).forEach(group => {
            const d = group[0];
            const centerLon = d.lon;
            const centerLat = d.lat;
            const latitudeRadians = centerLat * (Math.PI / 180);
    
            const maxRadiusLatDegrees = (textLineLengthMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
            const maxRadiusLonDegrees = (textLineLengthMeters / EARTH_RADIUS_METERS) * (180 / Math.PI) / Math.cos(latitudeRadians);
    
            const minAngle = Math.min(...group.map(d => d.minAngle));
            const maxAngle = Math.max(...group.map(d => d.maxAngle));
            const centerAngle = (minAngle + maxAngle) / 2;
    
            // Prepare text
            const labelText = labels[d.sourceKey] || d.sourceKey;
            const textLength = labelText.length;
    
            // 🔥 Adapt offset based on both horizontalness and text length
            const horizontalness = Math.abs(Math.cos(centerAngle)); // near 1 if line is horizontal
            const extraFactor = 1 + (horizontalness * (textLength * 1.5)); 
            // ➔ textLength / 8 is a normalizer (you can adjust)
    
            const extraOffsetMeters = baseLabelOffsetMeters * extraFactor;
    
            const extraOffsetLat = (extraOffsetMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
            const extraOffsetLon = (extraOffsetMeters / EARTH_RADIUS_METERS) * (180 / Math.PI) / Math.cos(latitudeRadians);
    
            const labelLon = centerLon + (maxRadiusLonDegrees + extraOffsetLon) * Math.cos(centerAngle);
            const labelLat = centerLat + (maxRadiusLatDegrees + extraOffsetLat) * Math.sin(centerAngle);
    
            curLabels.push({
                position: [
                    labelLon,
                    labelLat,
                    elevation + 0.02,
                ],
                text: labelText
            });
        });
    
        return new deck.TextLayer({
            id,
            data: curLabels,
            pickable: false,
            getPosition: d => d.position,
            getText: d => d.text,
            getSize: () => textSizeMeters,
            sizeUnits: 'meters',
            getColor: [0, 0, 0],
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'bottom',
            billboard: true,
            fontFamily: 'Montserrat',
        });
    };


    // --- Handle before, after or both --- //

    if (!dataAft) {
        const roseDataBef = generateRoseData(
            dataBef, colorsBef, true, maxRadiusMeters, numCurvePoints, elevation, activeSources, true, false,
        );

        return [
            new deck.PolygonLayer({
                id: 'rose-diagram-layer-bef',
                data: roseDataBef,
                pickable: true,
                stroked: true,
                getPolygon: d => d.polygon,
                getFillColor: d => d.color,
                getLineColor: d => [0, 0, 0, d.color[3] * 0.8],
                lineWidthUnits: 'meters',
                getLineWidth: lineWidthMeters,
            }),
            createMaxRadiusCircleLayer('rose-diagram-circle-outline-bef', roseDataBef, maxRadiusMeters),
            createSourceLinesLayer('rose-diagram-source-lines-bef', roseDataBef, textLineLengthMeters, elevation, sensorsSourceLabelDisplayed),
            createSourceLabelsLayer('rose-diagram-source-labels-bef', roseDataBef, textLineLengthMeters, labels, elevation, sensorsSourceLabelDisplayed),
            createCircleBadgeLayer('rose-diagram-circle-badge-bef', roseDataBef),
            createTextBadgeLayer('rose-diagram-text-bef', roseDataBef),
        ];
    }

    if (!dataBef) {
        const roseDataAft = generateRoseData(
            dataAft, colorsAft, true, maxRadiusMeters, numCurvePoints, elevation, activeSources, false, false,
        );

        return [
            new deck.PolygonLayer({
                id: 'rose-diagram-layer-aft',
                data: roseDataAft,
                pickable: true,
                stroked: true,
                getPolygon: d => d.polygon,
                getFillColor: d => d.color,
                getLineColor: d => [0, 0, 0, d.color[3] * 0.8],
                lineWidthUnits: 'meters',
                getLineWidth: lineWidthMeters,
            }),
            createMaxRadiusCircleLayer('rose-diagram-circle-outline-aft', roseDataAft, maxRadiusMeters),
            createSourceLinesLayer('rose-diagram-source-lines-aft', roseDataAft, textLineLengthMeters, elevation, sensorsSourceLabelDisplayed),
            createSourceLabelsLayer('rose-diagram-source-labels-aft', roseDataAft, textLineLengthMeters, labels, elevation, sensorsSourceLabelDisplayed),
            createCircleBadgeLayer('rose-diagram-circle-badge-aft', roseDataAft),
            createTextBadgeLayer('rose-diagram-text-aft', roseDataAft),
        ];
    }

    // --- compare mode: before/after together --- //
    const roseDataBef = generateRoseData(
        dataBef, colorsBef, true, maxRadiusMeters, numCurvePoints, elevation, activeSources, true, true, gapSizeMeters
    );
    const roseDataAft = generateRoseData(
        dataAft, colorsAft, false, maxRadiusMeters, numCurvePoints, elevation, activeSources, false, true, gapSizeMeters
    );

    const dummyRoseDataAft = generateRoseData(
        dataAft, colorsAft, false, maxRadiusMeters, numCurvePoints, elevation, activeSources, false, true, 0
    );
    const dummyRoseDataBef = generateRoseData(
        dataBef, colorsBef, false, maxRadiusMeters, numCurvePoints, elevation, activeSources, true, true, 0
    );

    return [
        new deck.PolygonLayer({
            id: 'rose-diagram-layer-bef',
            data: roseDataBef,
            pickable: true,
            stroked: true,
            getPolygon: d => d.polygon,
            getFillColor: d => d.color,
            getLineColor: d => [0, 0, 0, d.color[3] * 0.8],
            lineWidthUnits: 'meters',
            getLineWidth: lineWidthMeters,
        }),
        new deck.PolygonLayer({
            id: 'rose-diagram-layer-aft',
            data: roseDataAft,
            pickable: true,
            stroked: true,
            getPolygon: d => d.polygon,
            getFillColor: d => d.color,
            getLineColor: d => [0, 0, 0, d.color[3] * 0.8],
            lineWidthUnits: 'meters',
            getLineWidth: lineWidthMeters,
        }),
        createMaxRadiusCircleLayer('rose-diagram-circle-outline-bef', dummyRoseDataAft, maxRadiusMeters + gapSizeMeters/2),
        createMaxRadiusCircleLayer('rose-diagram-circle-outline-aft', dummyRoseDataBef, maxRadiusMeters + gapSizeMeters/2),
        createSourceLinesLayer('rose-diagram-source-lines-bef', roseDataBef, textLineLengthMeters, elevation, sensorsSourceLabelDisplayed),
        createSourceLabelsLayer('rose-diagram-source-labels-bef', roseDataBef, textLineLengthMeters, elevation, labels, sensorsSourceLabelDisplayed),
        createSourceLinesLayer('rose-diagram-source-lines-aft', roseDataAft, textLineLengthMeters, elevation, sensorsSourceLabelDisplayed),
        createSourceLabelsLayer('rose-diagram-source-labels-aft', roseDataAft, textLineLengthMeters, elevation, labels, sensorsSourceLabelDisplayed),
        createTextBadgeLayer('rose-diagram-text-bef', roseDataBef),
        createCircleBadgeLayer('rose-diagram-circle-badge-aft', roseDataAft),
        createTextBadgeLayer('rose-diagram-text-aft', roseDataAft),
    ];
}