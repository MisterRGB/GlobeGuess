# 3D Globe Country Guessing Game

A web-based geography game where players guess countries on a 3D interactive globe.

## Features

- **3D Globe Visualization**: Interactive 3D globe using D3.js
- **Two Game Modes**: Easy mode with country boundaries visible, hard mode without boundaries
- **Scoring System**: Points awarded based on accuracy and speed
- **Educational Facts**: Learn about each country after guessing
- **Visual Feedback**: Color-coded results and animated travel lines
- **Sound Effects**: Auditory feedback for player actions

## Game Rules

1. Choose a game mode (easy or hard)
2. The game will randomly select a country for you to find
3. Click on the globe where you think the country is located
4. Points are awarded based on your accuracy:
   - 1000 points: Guess inside the country
   - 500 points: Within 300km of the boundary
   - 100 points: Within 500km of the boundary
5. After guessing, you'll see facts about the country
6. Continue until you've guessed all countries

## How to Run

No installation required! Simply:

1. Download the files to your computer
2. Add sound files to the sounds directory (see `/sounds/README.md`)
3. Open `index.html` in your web browser

The game works directly from the browser without any build steps or installation.

## Dependencies (Loaded via CDN)

- D3.js for globe visualization
- Topojson for handling geographic data
- RESTCountries API for country facts and flags

## Browser Compatibility

The game works best in modern browsers that support ES6 and SVG.

## Note about Sounds

For the game to have sound effects, you'll need to add your own MP3 files to the sounds directory:
- `correct.mp3`: Sound for correct guesses
- `close.mp3`: Sound for close guesses
- `wrong.mp3`: Sound for wrong guesses
- `click.mp3`: Sound for button clicks

You can find free sound effects from sources like freesound.org, mixkit.co, or zapsplat.com.

## License

MIT 