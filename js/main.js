// No imports needed as we're using CDN for d3 and topojson

// First define width/height
const width = window.innerWidth - 300;
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
    currentScale: Math.min(width, height) * 0.4  // Now width/height are defined
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
    gameModeSelection: document.querySelector('.game-mode-selection'),
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

// Create SVG container
const svg = elements.globe.append('svg')
    .attr('width', width)
    .attr('height', height);

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
    globeGroup.selectAll('.country').remove();
    
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
    
    // Clear existing boundaries
    globeGroup.selectAll('.country-boundary').remove();
    
    // Only draw boundaries in Hard mode
    if (config.gameMode === 'hard') {
        globeGroup.selectAll('.country-boundary')
            .data(countries)
            .enter()
            .append('path')
            .attr('class', 'country-boundary')
            .attr('d', path);
    }
}

// Handle country click
function handleCountryClick(event, d) {
    if (!config.gameInProgress || !config.currentCountry) return;
    
    playSound(elements.sounds.click);
    
    const guessedCountryId = d.id;
    const guessedCountry = d;
    const targetCountry = config.currentCountry;
    
    // Calculate distance between guess and target
    const distance = calculateDistance(guessedCountry, targetCountry);
    
    // Determine score based on distance
    let pointsAwarded = 0;
    let resultClass = '';
    
    if (guessedCountryId === targetCountry.id) {
        // Correct guess
        pointsAwarded = 1000;
        resultClass = 'correct';
        playSound(elements.sounds.correct);
    } else if (distance <= 300) {
        // Within 300km
        pointsAwarded = 500;
        resultClass = 'close';
        playSound(elements.sounds.close);
    } else if (distance <= 500) {
        // Within 500km
        pointsAwarded = 100;
        resultClass = 'somewhat-close';
        playSound(elements.sounds.close);
    } else {
        // Wrong guess
        pointsAwarded = 0;
        resultClass = 'wrong';
        playSound(elements.sounds.wrong);
    }
    
    // Update score
    config.score += pointsAwarded;
    elements.score.textContent = config.score;
    
    // Highlight the guessed country
    d3.select(`#country-${guessedCountryId}`)
        .classed(`country-highlight ${resultClass}`, true);
    
    // Highlight the target country
    d3.select(`#country-${targetCountry.id}`)
        .classed(`country-highlight ${resultClass}`, true);
    
    // Add guess marker
    const coords = d3.pointer(event);
    globeGroup.append('circle')
        .attr('class', 'guess-marker')
        .attr('cx', coords[0])
        .attr('cy', coords[1])
        .attr('r', 5);
    
    // Draw travel line
    const targetCoords = projection(d3.geoCentroid(targetCountry));
    if (targetCoords && !isNaN(targetCoords[0]) && !isNaN(targetCoords[1])) {
        globeGroup.append('path')
            .attr('class', 'travel-line')
            .attr('d', `M${coords[0]},${coords[1]}L${targetCoords[0]},${targetCoords[1]}`);
    }
    
    // Add country to guessed countries
    config.guessedCountries.push(targetCountry.id);
    
    // Stop timer
    clearInterval(config.timer);
    
    // Show country info
    showCountryInfo(targetCountry);
    
    // Update game status
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
    
    // Fetch country flag and facts
    try {
        const response = await fetch(`https://restcountries.com/v3.1/alpha/${country.id}`);
        const countryData = await response.json();
        const data = countryData[0];
        
        // Display flag
        elements.flagContainer.innerHTML = `<img src="${data.flags.png}" alt="${data.name.common} flag">`;
        
        // Display facts
        const facts = `
            <p><strong>Capital:</strong> ${data.capital ? data.capital[0] : 'N/A'}</p>
            <p><strong>Population:</strong> ${data.population.toLocaleString()}</p>
            <p><strong>Region:</strong> ${data.region}</p>
            <p><strong>Languages:</strong> ${Object.values(data.languages || {}).join(', ') || 'N/A'}</p>
            <p><strong>Currency:</strong> ${Object.values(data.currencies || {}).map(c => c.name).join(', ') || 'N/A'}</p>
        `;
        
        elements.countryFacts.innerHTML = facts;
    } catch (error) {
        elements.countryFacts.innerHTML = '<p>Error loading country data</p>';
        console.error('Error fetching country data:', error);
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
    
    // Update game status
    config.gameInProgress = true;
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
    
    d3.timer(function(elapsed) {
        if (!config.rotating) return true;
        
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale(); // Scale sensitivity by zoom level
        projection.rotate([rotate[0] - 0.1 * k, rotate[1]]);
        
        updateGlobe();
        return false;
    });
}

// Drag functions
function dragStarted() {
    config.rotating = false;
    config.initialRotation = projection.rotate();
}

function dragged(event) {
    const rotate = projection.rotate();
    const k = sensitivity / projection.scale(); // Scale sensitivity by zoom level
    
    projection.rotate([
        rotate[0] + event.dx * k,
        rotate[1] - event.dy * k,
        rotate[2]
    ]);
    
    updateGlobe();
}

// Start the game with selected mode
function startGame(mode) {
    config.gameMode = mode;
    config.score = 0;
    config.guessedCountries = [];
    
    elements.score.textContent = '0';
    elements.gameModeSelection.classList.add('hidden');
    elements.gameInfo.classList.remove('hidden');
    
    // Clear any previous countries and boundaries
    globeGroup.selectAll('.country, .country-boundary').remove();
    
    // Load countries with the selected mode
    loadGeoData();
    
    // Start the first round
    startNewRound();
}

// Event listeners
elements.modeEasy.addEventListener('click', () => {
    playSound(elements.sounds.click);
    startGame('easy');
});

elements.modeHard.addEventListener('click', () => {
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
    
    elements.score.textContent = '0';
    elements.timer.textContent = '00:00';
    elements.countryInfo.classList.add('hidden');
    elements.gameInfo.classList.add('hidden');
    elements.gameModeSelection.classList.remove('hidden');
    
    // Clear all visual elements
    globeGroup.selectAll('.country, .country-boundary, .guess-marker, .travel-line').remove();
}

// Initialize the game
window.addEventListener('load', initGlobe);

// Handle window resize
window.addEventListener('resize', () => {
    location.reload();
});

function handleZoom(event) {
    event.preventDefault();
    
    // Handle both wheel and touch events
    let delta;
    if (event.type === 'wheel') {
        delta = -event.deltaY * config.zoomSensitivity;
    } else if (event.type === 'touchmove' && event.touches.length === 2) {
        // Touch zoom is handled separately in handleTouchMove
        return;
    }
    
    // Calculate new scale
    config.currentScale = Math.max(
        config.minScale,
        Math.min(config.maxScale, config.currentScale + delta)
    );
    
    // Update projection
    projection.scale(config.currentScale);
    
    // Redraw everything
    updateGlobe();
}

function updateGlobe() {
    // Update globe elements with smooth transition
    globeGroup.selectAll('path')
        .transition()
        .duration(100)
        .attr('d', path);
        
    globeGroup.select('.sphere')
        .transition()
        .duration(100)
        .attr('r', projection.scale());
    
    // Update stars (if needed)
    updateStars();
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