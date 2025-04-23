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
    travelLine: null,      // Reference to the travel line element
    isFullscreen: false,
    fullscreenRequested: false
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
    rightPanel: document.getElementById('right-panel'),
    flagContainer: document.getElementById('flag-container'),
    countryFacts: document.getElementById('country-facts'),
    nextCountry: document.getElementById('next-country'),
    resetGame: document.getElementById('reset-game'),
    sounds: {
        correct: document.getElementById('correct-sound'),
        close: document.getElementById('close-sound'),
        wrong: document.getElementById('wrong-sound'),
        click: document.getElementById('click-sound')
    },
    fullscreenToggle: null,
    toggleStars: document.getElementById('toggle-stars-game'),
    music: null
};

// Add this after the DOM elements definition
elements.nextCountry.style.fontSize = '14px';
elements.nextCountry.style.padding = '8px 16px';
elements.resetGame.style.fontSize = '14px';
elements.resetGame.style.padding = '8px 16px';

// Then define projection
const projection = d3.geoOrthographic()
    .scale(isMobile() ? Math.min(width, height) * 0.6 : Math.min(width, height) * 0.4)
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

// Add this mapping object and function (e.g., near the top or before showCountryInfo)
const countryCodeMapping = {
    "004": "af", "008": "al", "012": "dz", "016": "as", "020": "ad", "024": "ao", "028": "ag", "031": "az", "032": "ar",
    "036": "au", "040": "at", "044": "bs", "048": "bh", "050": "bd", "051": "am", "052": "bb", "056": "be", "060": "bm",
    "064": "bt", "068": "bo", "070": "ba", "072": "bw", "076": "br", "084": "bz", "090": "sb", "092": "vg", "096": "bn",
    "100": "bg", "104": "mm", "108": "bi", "112": "by", "116": "kh", "120": "cm", "124": "ca", "132": "cv", "136": "ky",
    "140": "cf", "144": "lk", "148": "td", "152": "cl", "156": "cn", "158": "tw", "162": "cx", "166": "cc", "170": "co",
    "174": "km", "175": "yt", "178": "cg", "180": "cd", "184": "ck", "188": "cr", "191": "hr", "192": "cu", "196": "cy",
    "203": "cz", "204": "bj", "208": "dk", "212": "dm", "214": "do", "218": "ec", "222": "sv", "226": "gq", "231": "et",
    "232": "er", "233": "ee", "234": "fo", "238": "fk", "242": "fj", "246": "fi", "248": "ax", "250": "fr", "254": "gf",
    "258": "pf", "260": "tf", "262": "dj", "266": "ga", "268": "ge", "270": "gm", "275": "ps", "276": "de", "288": "gh",
    "292": "gi", "296": "ki", "300": "gr", "304": "gl", "308": "gd", "312": "gp", "316": "gu", "320": "gt", "324": "gn",
    "328": "gy", "332": "ht", "336": "va", "340": "hn", "344": "hk", "348": "hu", "352": "is", "356": "in", "360": "id",
    "364": "ir", "368": "iq", "372": "ie", "376": "il", "380": "it", "384": "ci", "388": "jm", "392": "jp", "398": "kz",
    "400": "jo", "404": "ke", "408": "kp", "410": "kr", "414": "kw", "417": "kg", "418": "la", "422": "lb", "426": "ls",
    "428": "lv", "430": "lr", "434": "ly", "438": "li", "440": "lt", "442": "lu", "446": "mo", "450": "mg", "454": "mw",
    "458": "my", "462": "mv", "466": "ml", "470": "mt", "474": "mq", "478": "mr", "480": "mu", "484": "mx", "492": "mc",
    "496": "mn", "498": "md", "499": "me", "500": "ms", "504": "ma", "508": "mz", "512": "om", "516": "na", "520": "nr",
    "524": "np", "528": "nl", "531": "cw", "533": "aw", "534": "sx", "535": "bq", "540": "nc", "548": "vu", "554": "nz",
    "558": "ni", "562": "ne", "566": "ng", "570": "nu", "574": "nf", "578": "no", "580": "mp", "581": "um", "583": "fm",
    "584": "mh", "585": "pw", "586": "pk", "591": "pa", "598": "pg", "600": "py", "604": "pe", "608": "ph", "612": "pn",
    "616": "pl", "620": "pt", "624": "gw", "626": "tl", "630": "pr", "634": "qa", "638": "re", "642": "ro", "643": "ru",
    "646": "rw", "652": "bl", "654": "sh", "659": "kn", "660": "ai", "662": "lc", "663": "mf", "666": "pm", "670": "vc",
    "674": "sm", "678": "st", "682": "sa", "686": "sn", "688": "rs", "690": "sc", "694": "sl", "702": "sg", "703": "sk",
    "704": "vn", "705": "si", "706": "so", "710": "za", "716": "zw", "724": "es", "728": "ss", "729": "sd", "732": "eh",
    "740": "sr", "744": "sj", "748": "sz", "752": "se", "756": "ch", "760": "sy", "762": "tj", "764": "th", "768": "tg",
    "772": "tk", "776": "to", "780": "tt", "784": "ae", "788": "tn", "792": "tr", "795": "tm", "796": "tc", "798": "tv",
    "800": "ug", "804": "ua", "807": "mk", "818": "eg", "826": "gb", "831": "gg", "832": "je", "833": "im", "834": "tz",
    "840": "us", "850": "vi", "854": "bf", "858": "uy", "860": "uz", "862": "ve", "876": "wf", "882": "ws", "887": "ye",
    "894": "zm"
    // Note: Antarctica (010) and some disputed territories might not have standard codes/flags
};

function getAlpha2Code(numericId) {
    // Ensure numericId is a string, padded if needed (e.g., '8' -> '008')
    const paddedId = String(numericId).padStart(3, '0');
    return countryCodeMapping[paddedId];
}

// Add this near the top with other utility functions
function isMobile() {
    return window.innerWidth <= 768;
}

// Add this with other utility functions
function handleResize() {
    if (isMobile() && config.gameInProgress) {
        document.getElementById('globe').style.height = '125%';
    } else {
        document.getElementById('globe').style.height = '100%';
    }
}

// Add this near other variable declarations

// Add this near the top with other config variables
const FORCE_DARK_MODE = true; // Set to false to revert to system preference

// Initialize the globe
function initGlobe() {
    // Ensure game info is HIDDEN at initialization
    document.getElementById('game-info-container').classList.add('hidden');
    
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

    // Apply initial theme
    updateTheme();
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

    if (config.gameMode === 'hard') {
        // Hard mode - remove all borders completely
        countryElements
            .style('stroke', 'none') // Remove borders
            .style('opacity', 0.8) // Fixed opacity
            .on('mouseover', null) // Remove hover effects
            .on('mouseout', null);
    } else {
        // Easy mode - enhanced borders
        countryElements
            .attr('opacity', d => d.id === config.currentCountry?.id ? 1 : 0.3)
            .style('stroke', d => 
                d.id === config.currentCountry?.id ? '#1a73e8' : 'rgba(24, 69, 114, 0.66)'
            )
            .style('stroke-width', d => 
                d.id === config.currentCountry?.id ? '0.4px' : '0.4px' // Thicker borders
            )
            .on('mouseover', function(d) {
                if (d.id === config.currentCountry?.id) {
                    d3.select(this).style('opacity', 1);
                }
            })
            .on('mouseout', function(d) {
                if (d.id === config.currentCountry?.id) {
                    d3.select(this).style('opacity', 1);
                }
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
    config.rotating = false; // Disable rotation during zoom
    
    // Enable next country button
    elements.nextCountry.disabled = false;
    elements.nextCountry.classList.remove('disabled');
    
    // Unhide right panel immediately (before zoom)
    elements.rightPanel.classList.remove('hidden');
    
    // Zoom to the target country
    const centroid = d3.geoCentroid(targetCountry);
    const zoomScale = Math.min(width, height) * 0.8; // Larger zoom scale
    
    d3.transition()
        .duration(1000)
        .tween("zoom", function() {
            const r = d3.interpolate(projection.rotate(), [-centroid[0], -centroid[1], 0]);
            const s = d3.interpolate(projection.scale(), zoomScale);
            return function(t) {
                projection.rotate(r(t)).scale(s(t));
                globeGroup.selectAll('path').attr('d', path);
                globeGroup.select('.sphere').attr('r', projection.scale());
                
                // Update guess marker position
                if (config.guessMarker) {
                    const newPos = projection(config.lastGuess.geoCoords);
                    config.guessMarker
                        .attr('cx', newPos[0])
                        .attr('cy', newPos[1]);
                }
                
                // Update travel line
                if (config.travelLine) {
                    const newTargetPos = projection(config.lastGuess.targetCentroid);
                    config.travelLine
                        .attr('d', `M${projection(config.lastGuess.geoCoords)[0]},${projection(config.lastGuess.geoCoords)[1]}L${newTargetPos[0]},${newTargetPos[1]}`);
                }
            };
        })
        .on("end", function() {
            // Show country info after zoom completes
    showCountryInfo(targetCountry);
    
    // Update game status (but don't disable interaction)
    config.gameInProgress = false;
        });
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

// Show country information (Updated)
async function showCountryInfo(country) {
    if (!country?.id) return;

    const numericId = country.id;
    const alpha2Code = getAlpha2Code(numericId); // Get the alpha-2 code
    const countryName = country.properties.name;
    
    if (!alpha2Code) {
        console.warn(`No alpha-2 code found for numeric ID: ${numericId} (${countryName})`);
        // Handle cases where mapping might be missing (optional)
    }

    try {
        // Load facts from local facts.json
        const factsResponse = await fetch('data/facts.json');
        const factsData = await factsResponse.json();

        // Find matching country facts by name
        const countryFacts = factsData[countryName] || "No facts available for this country.";
        
        // Use alpha2Code for the flag path
        elements.flagContainer.innerHTML = `
            <div class="country-header" style="display: flex; align-items: center; gap: 10px;">
                <img src="flags/${alpha2Code ? alpha2Code.toLowerCase() : 'unknown'}.svg" 
                     alt="${countryName} flag" 
                     class="country-flag"
                     style="width: 64px; height: auto; border: 1px solid #ddd;"
                     onerror="handleFlagError(this, '${alpha2Code || numericId}')"> 
                <h2 style="margin: 0; font-size: 24px;">${countryName}</h2>
            </div>
        `;
        
        // Parse and format the facts if available
        if (typeof countryFacts === 'string') {
            // Split the facts string into individual sentences
            const factSections = countryFacts.split('. ').filter(section => section.trim().length > 0);
            
            let formattedFacts = '<div class="formatted-facts">';
            
            factSections.forEach(section => {
                // Extract the heading (text before the first colon)
                const colonIndex = section.indexOf(':');
                if (colonIndex > 0) {
                    const heading = section.substring(0, colonIndex);
                    let content = section.substring(colonIndex + 1).trim();
                    
                    // Get appropriate icon for each heading
                    const icon = getFactIcon(heading);
                    
                    // Special handling for currency to ensure consistent formatting
                    if (heading === 'Currency') {
                        content = content.replace(/\(.*\)/g, '').trim();
                    }
                    
                    formattedFacts += `
                        <div class="fact-item">
                            <span class="fact-icon" style="font-size: 0.8em">${icon}</span>
                            <div class="fact-content">
                                <strong>${heading}:</strong> ${content}
            </div>
                        </div>`;
                } else {
                    formattedFacts += `
                        <div class="fact-item">
                            ${section}
                        </div>`;
                }
            });
            
            formattedFacts += '</div>';
            elements.countryFacts.innerHTML = formattedFacts;
        } else {
            elements.countryFacts.innerHTML = '<div class="error">Invalid facts format</div>';
        }
        
        elements.rightPanel.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading country facts:', error);
        elements.countryFacts.innerHTML = '<div class="error">Failed to load facts</div>';
        elements.rightPanel.classList.remove('hidden');
    }
    
    updateCountriesLeft();
}

// Helper function to get icons for fact categories
function getFactIcon(heading) {
    const iconMap = {
        'Capital': '🏛️',
        'Languages': '🗣️',
        'Population': '👥',
        'Currency': '💰',
        'Known for': '🌟',
        'Also famous for': '⭐',
        'Food': '🍽️',
        'Religion': '🙏',
        'Climate': '☀️',
        'Brief History': '📜'
    };
    
    return iconMap[heading] || 'ℹ️';
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
    // Ensure game info panel is visible
    document.getElementById('game-info-container').classList.remove('hidden');
    
    // Hide country info panel
    if (elements.rightPanel) {
        elements.rightPanel.classList.add('hidden');
    }
    
    // Clear previous guess markers
    globeGroup.selectAll('.guess-marker, .travel-line').remove();
    
    // Disable next country button at start of round
    if (elements.nextCountry) {
        elements.nextCountry.disabled = true;
        elements.nextCountry.classList.add('disabled');
    }
    
    // Select a new country
    config.currentCountry = selectRandomCountry();
    
    if (!config.currentCountry) {
        // Game completed
        alert('Congratulations! You have guessed all countries!');
        return;
    }
    
    // Display the country name to guess
    if (elements.countryToGuess) {
    elements.countryToGuess.textContent = config.currentCountry.properties.name;
    }
    
    // Reset timer
    config.startTime = Date.now();
    startTimer();
    
    // Update game state
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
    // Disable and grey out the clicked button
    const clickedButton = mode === 'easy' ? elements.modeEasy : elements.modeHard;
    clickedButton.disabled = true;
    clickedButton.classList.add('disabled');

    // Reset the other button (if needed)
    const otherButton = mode === 'easy' ? elements.modeHard : elements.modeEasy;
    otherButton.disabled = false;
    otherButton.classList.remove('disabled');

    // Hide the stars toggle button
    if (elements.toggleStars) {
        elements.toggleStars.style.display = 'none';
    }

    // Rest of the function...
    config.gameMode = mode;
    config.gameInProgress = true;
    config.score = 0;
    elements.score.textContent = config.score;

    // Hide start screen
    document.getElementById('start-screen').classList.add('hidden');

    // Show game info panel
    elements.gameInfo.classList.remove('hidden');

    // Mobile-specific height change
    if (isMobile()) {
        document.getElementById('globe').style.height = '125%';
    }

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
    // Show the stars toggle button
    if (elements.toggleStars) {
        elements.toggleStars.style.display = 'flex'; // Or 'block', depending on your styling
    }

    // Reset mode buttons
    elements.modeEasy.disabled = false;
    elements.modeEasy.classList.remove('disabled');
    elements.modeHard.disabled = false;
    elements.modeHard.classList.remove('disabled');

    // Hide game info panel (returns to start screen)
    document.getElementById('game-info-container').classList.add('hidden');
    
    // Show start screen
    document.getElementById('start-screen').classList.remove('hidden');
    
    // Clear all visual elements
    globeGroup.selectAll('.country, .country-boundary, .guess-marker, .travel-line').remove();
    
    // Reset UI elements
    if (elements.score) elements.score.textContent = '0';
    if (elements.timer) elements.timer.textContent = '00:00';
    
    // Hide country info panel
    if (elements.rightPanel) {
        elements.rightPanel.classList.add('hidden');
    }
    
    // Reset game state
    config.gameInProgress = false;
    config.guessedCountries = [];
    clearInterval(config.timer);
    
    // Mobile-specific height reset
    if (isMobile()) {
        document.getElementById('globe').style.height = '100%';
    }
    
    // Rest of the function...
    elements.gameInfo.classList.add('hidden');
    elements.countryToGuess.textContent = '';
    elements.countryFacts.innerHTML = '';
    elements.flagContainer.innerHTML = '';
    
    if (config.guessMarker) {
        config.guessMarker.remove();
        config.guessMarker = null;
    }
    
    if (config.travelLine) {
        config.travelLine.remove();
        config.travelLine = null;
    }
    
    // Reset rotation to initial state
    config.currentRotation = [...config.initialRotation];
    updateGlobe();
}

// Initialize the game
window.addEventListener('DOMContentLoaded', () => {
    initGlobe();
});

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

// Add this helper function to calculate visibility
function isCountryVisible(country, projection) {
    const bounds = d3.geoBounds(country);
    const [x1, y1] = projection([bounds[0][0], bounds[0][1]]);
    const [x2, y2] = projection([bounds[1][0], bounds[1][1]]);
    
    // Check if any part of the country is within viewport
    return !(isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2));
}

// Modify the updateGlobe function
function updateGlobe() {
    const path = d3.geoPath().projection(projection);
    
    // Update only visible countries
    globeGroup.selectAll('.country')
        .each(function(d) {
            const visible = isCountryVisible(d, projection);
            d3.select(this)
                .classed('hidden', !visible)
                .attr('d', visible ? path : null);
        });

    // Update sphere and other elements
    globeGroup.select('.sphere').attr('r', projection.scale());
    updateStars();
    
    // Rest of existing update logic...
}

// Sound handling
function preloadSounds() {
    const soundIds = ['correct', 'close', 'wrong', 'click'];
    soundIds.forEach(id => {
        const sound = elements.sounds[id];
    if (sound) {
            sound.load().catch(e => {
                console.warn(`Failed to load ${id} sound:`, e);
            });
        }
    });
}

function playSound(sound) {
    if (!sound) return;
    
    try {
        // Reset sound to start if already playing
        sound.currentTime = 0;
        sound.play().catch(e => {
            console.warn("Sound playback prevented:", e);
        });
    } catch (e) {
        console.warn("Sound error:", e);
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

// Remove the event listener for the deleted 'make-guess' button
/*
document.getElementById('make-guess').addEventListener('click', () => {
    // Show instructions for clicking on the globe
    alert("Click on the globe to make your guess!");
});
*/

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

// Updated handleFlagError function
function handleFlagError(imgElement, code) {
    console.error(`Flag not found for code: ${code}. Attempted path: ${imgElement.src}`); // More specific error
    imgElement.onerror = null; // Prevent infinite loops
    imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgNTAiPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiIGZpbGw9IiNmMGYwZjAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjI1IiByPSIxNSIgZmlsbD0iIzFhNzNlOCIvPjx0ZXh0IHg9IjUwIiB5PSIzMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMCIgZmlsbD0id2hpdGUiPj88L3RleHQ+PC9zdmc+';
    imgElement.style.opacity = '0.7';
}

// Toggle the panel's expanded state
function togglePanel() {
    const rightPanel = document.querySelector('.right-panel');
    rightPanel.classList.toggle('expanded');
}

// Initialize the mobile panel (run on load/resize)
function setupMobilePanel() {
    if (window.innerWidth <= 768) {
        const rightPanel = document.querySelector('.right-panel');
        if (!rightPanel.querySelector('.panel-toggle')) {
            const toggleButton = document.createElement('div');
            toggleButton.className = 'panel-toggle';
            toggleButton.textContent = 'Country Facts'; // Customize label
            toggleButton.addEventListener('click', togglePanel);
            rightPanel.insertBefore(toggleButton, rightPanel.firstChild);
        }
    }
}

// Set up event listeners
window.addEventListener('load', setupMobilePanel);
window.addEventListener('resize', setupMobilePanel);

document.addEventListener('click', (e) => {
    const rightPanel = document.querySelector('.right-panel');
    if (!rightPanel.contains(e.target) && !e.target.closest('.panel-handle')) {
        rightPanel.classList.remove('visible');
    }
});

// Add this to initialization
window.addEventListener('resize', debounce(handleResize, 200));

// Update the theme function to use forced dark mode
function updateTheme() {
    // Always use dark mode if forced, otherwise check system preference
    const useDarkMode = FORCE_DARK_MODE || window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Globe colors
    globeGroup.select('.sphere')
        .attr('fill', useDarkMode ? '#0d1a26' : '#0d47a1');
    
    // Country colors
    globeGroup.selectAll('.country')
        .attr('fill', useDarkMode ? '#2a4365' : '#4285f4')
        .attr('stroke', useDarkMode ? '#1e3a8a' : '#1a73e8');
    
    // UI colors
    document.documentElement.style.setProperty(
        '--md-sys-color-primary', 
        useDarkMode ? '#a8c7ff' : '#1a73e8'
    );
    
    document.documentElement.style.setProperty(
        '--md-sys-color-on-primary', 
        useDarkMode ? '#002f66' : '#ffffff'
    );
    
    // Text and background colors
    const textElements = document.querySelectorAll('.game-info, .right-panel, #country-to-guess');
    textElements.forEach(el => {
        el.style.color = useDarkMode ? '#e2e2e6' : '#1a1c1e';
    });
    
    const bgElements = document.querySelectorAll('.game-info, .right-panel');
    bgElements.forEach(el => {
        el.style.backgroundColor = useDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(240, 240, 240, 0.95)';
    });
}

// Call this once during initialization
updateTheme();

// For any dynamically created elements, ensure they use the same classes
function createUIElement() {
    const element = document.createElement('div');
    element.className = 'ui-panel'; // Use consistent class names
    // ...
}

// Or update existing elements
document.querySelectorAll('.ui-element').forEach(el => {
    el.style.backgroundColor = 'rgba(30, 30, 30, 0.95)';
    el.style.color = '#e2e2e6';
});

// In mobile mode
if (isMobile()) {
    // Use smaller visibility threshold
    const mobileScale = projection.scale() * 0.7;
    projection.scale(mobileScale);
}

// Update the toggleStars function
function toggleStars() {
    const starsGroup = svg.select('.stars');
    const isHidden = starsGroup.style('display') === 'none';
    
    if (isHidden) {
        starsGroup.style('display', 'block');
        elements.toggleStars.classList.add('active');
    } else {
        starsGroup.style('display', 'none');
        elements.toggleStars.classList.remove('active');
    }
}

// Add event listener to the stars toggle button
if (elements.toggleStars) {
    elements.toggleStars.addEventListener('click', toggleStars);
}


