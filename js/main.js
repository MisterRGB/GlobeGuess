// No imports needed as we're using CDN for d3 and topojson

// First define width/height
const width = window.innerWidth;
const height = window.innerHeight;
const sensitivity = 75;

// Game configuration
const config = {
    gameMode: null, // 'easy' or 'hard'
    currentCountry: null,
    guessedCountries: [],
    allCountries: [],
    score: 0,
    startTime: null,
    timer: null,
    rotating: true,
    gameInProgress: false,
    initialRotation: [0, 0, 0], // Store initial rotation [lambda, phi, gamma]
    currentRotation: [0, 0, 0],  // Current rotation state
    starFieldDepth: 1000,    // Depth of star field
    starFieldRadius: 2,     // How far stars extend from center
    starFieldCount: 200,    // Reduced from 1000 to fewer stars
    starCount: 200,         // Number of stars
    starSize: 0.5,          // Base star size
    minScale: 100,          // Minimum zoom level
    maxScale: 1000,         // Maximum zoom level
    zoomSensitivity: 0.1,   // How fast zooming happens
    currentScale: Math.min(width, height) * 0.4,  // Now width/height are defined
    lastGuess: null,      // Stores the last guess information
    guessMarker: null,    // Reference to the guess marker element
    travelLine: null      // Reference to the travel line element
};

// DOM elements
const elements = {
    globe: d3.select('#globe'),
    countryToGuess: document.getElementById('country-to-guess'),
    timer: document.getElementById('timer'),
    score: document.getElementById('score'),
    countriesLeft: document.getElementById('countries-left'),
    modeEasy: document.getElementById('mode-easy'),
    modeHard: document.getElementById('mode-hard'),
    gameInfo: document.querySelector('.game-info'),
    countryInfo: document.getElementById('country-info'),
    countryName: document.getElementById('country-name'),
    flagContainer: document.getElementById('flag-container'),
    countryFacts: document.getElementById('country-facts'),
    nextCountry: document.getElementById('next-country'),
    resetGame: document.getElementById('reset-game'),
    sounds: {
        correct: document.getElementById('correct-sound'),
        close: document.getElementById('close-sound'),
        wrong: document.getElementById('wrong-sound'),
        click: document.getElementById('click-sound')
    }
};

// Then define projection
const projection = d3.geoOrthographic()
    .scale(config.currentScale)
    .translate([width / 2, height / 2])
    .clipAngle(90)
    .precision(0.1);

const path = d3.geoPath().projection(projection);

// Create SVG container with centered viewBox
const svg = elements.globe.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('touch-action', 'none');

// Add this after creating the SVG container
svg.on("wheel", handleZoom);

// Create a group for stars
const starsGroup = svg.append('g').attr('class', 'stars');

// Create group for globe (countries will be inside this)
const globeGroup = svg.append('g').attr('class', 'globe-group');

// Add drag behavior to the entire SVG
const drag = d3.drag()
    .on('start', dragStarted)
    .on('drag', dragged);

// Touch state variables
let touchState = {
    initialDistance: null,
    initialScale: null
};

// Initialize the globe
function initGlobe() {
    // Add this at the beginning of the function
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('markerWidth', 4)
        .attr('markerHeight', 3)
        .attr('refX', 0)
        .attr('refY', 1.5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,0 L4,1.5 L0,3 Z')
        .attr('fill', 'white');
    
    // Prevent default wheel behavior
    svg.on("wheel.zoom", () => {}).on("wheel", handleZoom);
    
    // Add touch event listeners for pinch zoom
    svg.on("touchstart", handleTouchStart)
       .on("touchmove", handleTouchMove)
       .on("touchend", handleTouchEnd);
    
    // Apply drag to the SVG container
    svg.call(drag);
    
    // Add 3D stars
    createStars();
    
    // Add the globe sphere
    globeGroup.append('circle')
        .attr('class', 'sphere')
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .attr('r', projection.scale());

    // Initialize the path generator
    const path = d3.geoPath().projection(projection);
    
    loadGeoData();
}

// Create 3D stars with different depths
function createStars() {
    const stars = [];
    const globeRadius = projection.scale();
    
    for (let i = 0; i < config.starCount; i++) {
        // Generate random 3D coordinates within a sphere
        let x, y, z, distance;
        do {
            x = Math.random() * 2 - 1; // -1 to 1
            y = Math.random() * 2 - 1;
            z = Math.random() * 2 - 1;
            distance = Math.sqrt(x*x + y*y + z*z);
        } while (distance > 1 || distance < 0.3); // Keep stars in a shell
        
        // Scale to star field dimensions
        x *= globeRadius * config.starFieldRadius;
        y *= globeRadius * config.starFieldRadius;
        z *= config.starFieldDepth;
        
        stars.push({ x, y, z });
    }
    
    // Create star elements
    starsGroup.selectAll('.star')
        .data(stars)
        .enter()
        .append('circle')
        .attr('class', 'star')
        .attr('r', config.starSize)
        .attr('data-x', d => d.x)
        .attr('data-y', d => d.y)
        .attr('data-z', d => d.z);
    
    updateStars();
}

// Update star positions
function updateStars() {
    const centerX = width / 2;
    const centerY = height / 2;
    const focalLength = 800; // Perspective projection
    
    starsGroup.selectAll('.star').each(function() {
        const star = d3.select(this);
        let x = parseFloat(star.attr('data-x'));
        let y = parseFloat(star.attr('data-y'));
        let z = parseFloat(star.attr('data-z'));
        
        // Get current rotation
        const rotate = projection.rotate();
        const lambda = rotate[0] * Math.PI / 180; // Longitude
        const phi = rotate[1] * Math.PI / 180;    // Latitude
        
        // Apply 3D rotation (Y then X axis)
        // Rotate around Y axis (longitude)
        const x1 = x * Math.cos(lambda) - z * Math.sin(lambda);
        const z1 = x * Math.sin(lambda) + z * Math.cos(lambda);
        
        // Rotate around X axis (latitude)
        const y1 = y * Math.cos(phi) - z1 * Math.sin(phi);
        const z2 = y * Math.sin(phi) + z1 * Math.cos(phi);
        
        // Perspective projection
        const scale = focalLength / (focalLength + z2);
        const projX = x1 * scale + centerX;
        const projY = y1 * scale + centerY;
        
        // Size based on distance
        const size = Math.max(0.2, config.starSize * (1 - z2/config.starFieldDepth));
        const opacity = 0.5 + 0.5 * (1 - z2/config.starFieldDepth);
        
        star.attr('cx', projX)
            .attr('cy', projY)
            .attr('r', size)
            .style('opacity', opacity);
    });
}

// Load GeoJSON data
async function loadGeoData() {
    try {
        // Using direct CDN URL to fetch the countries data
        const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const worldData = await response.json();
        
        // Convert TopoJSON to GeoJSON using topojson-client from CDN
        const countries = topojson.feature(worldData, worldData.objects.countries);
        config.allCountries = countries.features;
        
        // Draw countries
        drawCountries(countries.features);
        
        // Start rotation
        startRotation();
        
        // Update countries counter
        updateCountriesLeft();
    } catch (error) {
        console.error('Error loading geographic data:', error);
        alert('Failed to load geographic data. Please check your internet connection.');
    }
}

// Draw countries on the globe
function drawCountries(countries) {
    // Clear existing countries
    globeGroup.selectAll('.country, .country-boundary').remove();
    
    // Draw countries
    const countryElements = globeGroup.selectAll('.country')
        .data(countries)
        .enter()
        .append('path')
        .attr('class', 'country')
        .attr('d', path)
        .attr('id', d => `country-${d.id}`)
        .attr('data-name', d => d.properties.name)
        .on('click', handleCountryClick);
    
    // Remove ALL boundaries in Hard Mode
    if (config.gameMode === 'hard') {
        countryElements
            .style('stroke', 'none') // Remove borders
            .style('opacity', 0.8) // Fixed opacity (no hover effect)
            .on('mouseover', null) // Remove hover events
            .on('mouseout', null);
    } else {
        // Easy Mode behavior (with borders and hover)
        globeGroup.selectAll('.country-boundary')
            .data(countries)
            .enter()
            .append('path')
            .attr('class', 'country-boundary')
            .attr('d', path);
        
        countryElements
            .on('mouseover', function() {
                d3.select(this).style('opacity', 1);
            })
            .on('mouseout', function() {
                d3.select(this).style('opacity', 0.8);
            });
    }
}

// Handle country click
function handleCountryClick(event, d) {
    if (!config.gameInProgress || !config.currentCountry) return;
    
    playSound(elements.sounds.click);
    
    const guessedCountryId = d.id;
    const guessedCountry = d;
    const targetCountry = config.currentCountry;
    
    // Store the clicked position in geographic coordinates
    const clickedCoords = projection.invert(d3.pointer(event));
    config.lastGuess = {
        screenCoords: d3.pointer(event),
        geoCoords: clickedCoords,
        targetCountry: targetCountry,
        targetCentroid: d3.geoCentroid(targetCountry)
    };
    
    // Calculate distance and score
    const distance = calculateDistance(guessedCountry, targetCountry);
    let pointsAwarded = 0;
    let resultClass = '';
    
    if (guessedCountryId === targetCountry.id) {
        pointsAwarded = 1000;
        resultClass = 'correct';
        playSound(elements.sounds.correct);
    } else if (distance <= 300) {
        pointsAwarded = 500;
        resultClass = 'close';
        playSound(elements.sounds.close);
    } else if (distance <= 500) {
        pointsAwarded = 100;
        resultClass = 'somewhat-close';
        playSound(elements.sounds.close);
    } else {
        pointsAwarded = 0;
        resultClass = 'wrong';
        playSound(elements.sounds.wrong);
    }
    
    // Update score
    config.score += pointsAwarded;
    elements.score.textContent = config.score;
    
    // Highlight the target country
    d3.select(`#country-${targetCountry.id}`)
        .classed(`country-highlight ${resultClass}`, true);
    
    // Clear previous markers
    globeGroup.selectAll('.guess-marker, .travel-line').remove();
    
    // Add persistent guess marker
    config.guessMarker = globeGroup.append('circle')
        .attr('class', 'guess-marker')
        .attr('cx', config.lastGuess.screenCoords[0])
        .attr('cy', config.lastGuess.screenCoords[1])
        .attr('r', 5);
    
    // Create the travel line path (initially zero length)
    const targetCoords = projection(config.lastGuess.targetCentroid);
    config.travelLine = globeGroup.append('path')
        .attr('class', 'travel-line')
        .attr('d', `M${config.lastGuess.screenCoords[0]},${config.lastGuess.screenCoords[1]}L${config.lastGuess.screenCoords[0]},${config.lastGuess.screenCoords[1]}`)
        .attr('stroke-dasharray', '0,1000') // Start with no visible line
        .attr('stroke-dashoffset', 0);
    
    // Animate the line drawing
    animateTravelLine(config.lastGuess.screenCoords, targetCoords);
    
    // Add country to guessed countries
    config.guessedCountries.push(targetCountry.id);
    
    // Stop timer but keep rotation enabled
    clearInterval(config.timer);
    config.rotating = true; // Ensure rotation can continue
    startRotation(); // Restart rotation
    
    // Show country info
    showCountryInfo(targetCountry);
    
    // Update game status (but don't disable interaction)
    config.gameInProgress = false;
}

// Calculate distance between two countries
function calculateDistance(country1, country2) {
    const centroid1 = d3.geoCentroid(country1);
    const centroid2 = d3.geoCentroid(country2);
    
    // Use d3.geoDistance to calculate the distance in radians
    const distance = d3.geoDistance(centroid1, centroid2);
    
    // Convert to kilometers (Earth radius is approximately 6371 km)
    return distance * 6371;
}

// Show country information
async function showCountryInfo(country) {
    elements.countryName.textContent = country.properties.name;
    
    try {
        const response = await fetch(`https://restcountries.com/v3.1/alpha/${country.id}`);
        const countryData = await response.json();
        const data = countryData[0];
        
        // Flag
        elements.flagContainer.innerHTML = `
            <h3>${data.name.common}</h3>
            <img src="${data.flags.png}" alt="${data.name.common} flag">
        `;
        
        // Facts
        const facts = `
            <div class="fact-group">
                <h4>Quick Facts</h4>
                <p><strong>Capital:</strong> ${data.capital ? data.capital[0] : 'N/A'}</p>
                <p><strong>Population:</strong> ${data.population.toLocaleString()}</p>
                <p><strong>Region:</strong> ${data.region}</p>
            </div>
            <div class="fact-group">
                <h4>Details</h4>
                <p><strong>Languages:</strong> ${Object.values(data.languages || {}).join(', ') || 'N/A'}</p>
                <p><strong>Currency:</strong> ${Object.values(data.currencies || {}).map(c => c.name).join(', ') || 'N/A'}</p>
            </div>
        `;
        
        elements.countryFacts.innerHTML = facts;
    } catch (error) {
        elements.countryFacts.innerHTML = '<p>Error loading country data</p>';
    }
    
    elements.countryInfo.classList.remove('hidden');
    updateCountriesLeft();
}

// Select a random country to guess
function selectRandomCountry() {
    const availableCountries = config.allCountries.filter(c => !config.guessedCountries.includes(c.id));
    
    if (availableCountries.length === 0) {
        // Game completed
        alert('Congratulations! You have guessed all countries!');
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * availableCountries.length);
    return availableCountries[randomIndex];
}

// Start a new round
function startNewRound() {
    // Hide country info panel
    elements.countryInfo.classList.add('hidden');
    
    // Clear previous guess markers and travel lines
    globeGroup.selectAll('.guess-marker, .travel-line').remove();
    
    // Select a new country
    config.currentCountry = selectRandomCountry();
    
    if (!config.currentCountry) {
        // No more countries
        return;
    }
    
    // Display the country name to guess
    elements.countryToGuess.textContent = config.currentCountry.properties.name;
    
    // Reset timer
    config.startTime = Date.now();
    startTimer();
    
    // Update game status and ensure rotation is enabled
    config.gameInProgress = true;
    config.rotating = true;
    startRotation();
}

// Start the game timer
function startTimer() {
    clearInterval(config.timer);
    
    config.timer = setInterval(() => {
        const elapsedTime = Date.now() - config.startTime;
        const seconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(seconds / 60);
        const displaySeconds = (seconds % 60).toString().padStart(2, '0');
        const displayMinutes = minutes.toString().padStart(2, '0');
        
        elements.timer.textContent = `${displayMinutes}:${displaySeconds}`;
    }, 1000);
}

// Update the countries left counter
function updateCountriesLeft() {
    const countriesLeft = config.allCountries.length - config.guessedCountries.length;
    elements.countriesLeft.textContent = countriesLeft;
}

// Start rotating the globe
function startRotation() {
    if (!config.rotating) return;
    
    let lastTime = 0;
    const rotationLoop = (time) => {
        if (!config.rotating) return;
        
        // Limit updates to ~60fps
        if (time - lastTime > 16) {
            const rotate = projection.rotate();
            const k = sensitivity / projection.scale();
            projection.rotate([rotate[0] - 0.1 * k, rotate[1]]);
            
            // Update without transitions
            updateGlobe();
            lastTime = time;
        }
        
        requestAnimationFrame(rotationLoop);
    };
    
    requestAnimationFrame(rotationLoop);
}

// Drag functions
function dragStarted() {
    config.rotating = false;
    config.initialRotation = projection.rotate();
}

function dragged(event) {
    const rotate = projection.rotate();
    const k = sensitivity / projection.scale();
    
    projection.rotate([
        rotate[0] + event.dx * k,
        rotate[1] - event.dy * k,
        rotate[2]
    ]);
    
    // Use requestAnimationFrame for smoother updates
    if (!this._frame) {
        this._frame = requestAnimationFrame(() => {
            updateGlobe();
            this._frame = null;
        });
    }
}

// Start the game with selected mode
function startGame(mode) {
    config.gameMode = mode;
    
    // Show game info panel
    document.getElementById('game-info-container').classList.remove('hidden');
    
    // Hide start screen
    document.getElementById('start-screen').classList.add('hidden');
    
    // Rest of initialization...
    config.score = 0;
    config.guessedCountries = [];
    
    // Clear any previous countries and boundaries
    globeGroup.selectAll('.country, .country-boundary').remove();
    
    // Load countries with the selected mode
    loadGeoData();
    
    // Start the first round
    startNewRound();
}

// Update event listeners to use the start screen buttons
document.getElementById('mode-easy').addEventListener('click', () => {
    playSound(elements.sounds.click);
    startGame('easy');
});

document.getElementById('mode-hard').addEventListener('click', () => {
    playSound(elements.sounds.click);
    startGame('hard');
});

elements.nextCountry.addEventListener('click', () => {
    playSound(elements.sounds.click);
    startNewRound();
});

elements.resetGame.addEventListener('click', () => {
    playSound(elements.sounds.click);
    resetGame();
});

// Reset the game
function resetGame() {
    clearInterval(config.timer);
    config.gameInProgress = false;
    config.guessedCountries = [];
    config.score = 0;
    
    // Hide game info panel
    document.getElementById('game-info-container').classList.add('hidden');
    
    // Show start screen
    document.getElementById('start-screen').classList.remove('hidden');
    
    // Clear all visual elements
    globeGroup.selectAll('.country, .country-boundary, .guess-marker, .travel-line').remove();
    
    // Reset UI elements
    elements.score.textContent = '0';
    elements.timer.textContent = '00:00';
    elements.countryInfo.classList.add('hidden');
}

// Initialize the game
window.addEventListener('load', initGlobe);

// Handle window resize
window.addEventListener('resize', () => {
    location.reload();
});

function handleZoom(event) {
    event.preventDefault();
    
    let delta;
    if (event.type === 'wheel') {
        delta = -event.deltaY * config.zoomSensitivity;
    } else if (event.type === 'touchmove' && event.touches.length === 2) {
        return;
    }
    
    // Calculate new scale relative to window size
    const baseScale = Math.min(width, height) * 0.4;
    config.currentScale = Math.max(
        baseScale * 0.5,  // min zoom
        Math.min(baseScale * 3, config.currentScale + delta)  // max zoom
    );
    
    projection.scale(config.currentScale);
    updateGlobe();
}

function updateGlobe() {
    // Update paths with new projection
    const path = d3.geoPath().projection(projection);
    
    // Update all elements
    globeGroup.selectAll('path')
        .attr('d', path);
    
    // Update sphere size
    globeGroup.select('.sphere')
        .attr('r', projection.scale());
    
    // Update stars and other elements
    updateStars();
    
    // Update markers and travel line if they exist
    if (config.lastGuess && config.travelLine && config.guessMarker) {
        const targetCoords = projection(config.lastGuess.targetCentroid);
        const currentMarkerPos = projection(config.lastGuess.geoCoords) || config.lastGuess.screenCoords;
        
        if (targetCoords && !isNaN(targetCoords[0]) && currentMarkerPos && !isNaN(currentMarkerPos[0])) {
            // Update marker position
            config.guessMarker
                .attr('cx', currentMarkerPos[0])
                .attr('cy', currentMarkerPos[1]);
            
            // Recreate the curved path
            const pathData = generateCurvedPath(currentMarkerPos, targetCoords);
            config.travelLine.attr('d', pathData);
            
            // Restore animation if it was running
            if (config.travelLine.classed('animated')) {
                config.travelLine.call(animateDashes);
            }
        }
    }
}

// Add this function at the top of your script
function playSound(sound) {
    if (sound) {
        sound.play().catch(e => {
            console.log("Sound playback prevented:", e);
            // Implement fallback or silent failure
        });
    }
}

function handleTouchStart() {
    if (event.touches.length === 2) {
        // Store initial touch positions and scale
        touchState.initialDistance = getTouchDistance(event.touches[0], event.touches[1]);
        touchState.initialScale = config.currentScale;
    }
}

function handleTouchMove(event) {
    if (event.touches.length === 2) {
        event.preventDefault();
        
        // Calculate current touch distance
        const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
        
        // Calculate zoom factor
        if (touchState.initialDistance) {
            const scaleFactor = currentDistance / touchState.initialDistance;
            config.currentScale = Math.max(
                config.minScale,
                Math.min(config.maxScale, touchState.initialScale * scaleFactor)
            );
            
            // Update projection
            projection.scale(config.currentScale);
            updateGlobe();
        }
    }
}

function handleTouchEnd() {
    touchState.initialDistance = null;
    touchState.initialScale = null;
}

// Helper function to calculate distance between two touches
function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Debounce function to limit rapid updates
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Apply debounce to updateGlobe (e.g., 50ms delay)
const debouncedUpdateGlobe = debounce(updateGlobe, 50);

function generateCurvedPath(startCoords, endCoords) {
    // Create great circle interpolator
    const interpolator = d3.geoInterpolate(
        projection.invert(startCoords),
        projection.invert(endCoords)
    );
    
    // Generate points along the great circle path
    const points = [];
    const steps = 20; // Number of intermediate points
    for (let i = 0; i <= steps; i++) {
        points.push(interpolator(i / steps));
    }
    
    // Convert to SVG path data
    let pathData = "M";
    points.forEach((point, i) => {
        const projected = projection(point);
        if (projected && !isNaN(projected[0])) {
            if (i > 0) pathData += "L";
            pathData += projected[0] + "," + projected[1];
        }
    });
    
    return pathData;
}

// Add to event listeners section
document.getElementById('make-guess').addEventListener('click', () => {
    // Show instructions for clicking on the globe
    alert("Click on the globe to make your guess!");
});

function animateTravelLine(startCoords, endCoords) {
    if (!config.travelLine || !startCoords || !endCoords) return;
    
    // Calculate the full path
    const pathData = `M${startCoords[0]},${startCoords[1]}L${endCoords[0]},${endCoords[1]}`;
    
    // Get the total length of the path
    const pathNode = config.travelLine.node();
    pathNode.setAttribute('d', pathData);
    const length = pathNode.getTotalLength();
    
    // Reset the path for animation
    config.travelLine
        .attr('stroke-dasharray', `${length},${length}`)
        .attr('stroke-dashoffset', length)
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0)
        .on('end', () => {
            // After animation completes, set the final path
            config.travelLine.attr('d', pathData);
        });
}

function createCurvedLine(startCoords, endCoords) {
    // Calculate the midpoint pushed outward from globe center
    const start = projection(startCoords);
    const end = projection(endCoords);
    const center = [width/2, height/2];
    
    // Calculate midpoint and push it outward
    const midX = (start[0] + end[0])/2;
    const midY = (start[1] + end[1])/2;
    const dx = midX - center[0];
    const dy = midY - center[1];
    const dist = Math.sqrt(dx*dx + dy*dy);
    const pushFactor = 1.2;
    
    const controlX = midX + (dx/dist) * pushFactor * 50;
    const controlY = midY + (dy/dist) * pushFactor * 50;
    
    // Create quadratic Bézier curve
    const pathData = `M${start[0]},${start[1]} Q${controlX},${controlY} ${end[0]},${end[1]}`;
    
    // Add the curved line to the globe with continuous animation
    config.travelLine = globeGroup.append('path')
        .attr('class', 'travel-line')
        .attr('d', pathData)
        .attr('stroke-dasharray', '5,3') // Dash pattern
        .attr('stroke-dashoffset', 0)
        .call(animateDashes); // Start continuous animation
}

// Continuous dash animation
function animateDashes(selection) {
    selection.transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', -8) // Reverse direction (negative value)
        .on('end', function() {
            d3.select(this)
                .attr('stroke-dashoffset', 0)
                .call(animateDashes); // Loop animation
        });
} 