// Sqnces Analysis Tool - Game Logic
class SqncesGame {
    constructor() {
        this.gameData = {
            6: {
                hiddenWord: 'tussle',
                sequence: 'uss',
                cutoff: 4400
            },
            7: {
                hiddenWord: 'sensory',
                sequence: 'nso',
                cutoff: 5770
            },
            8: {
                hiddenWord: 'drivable',
                sequence: 'dri',
                cutoff: 4700
            }
        };
        
        this.currentLength = 6;
        this.currentRow = 0;
        this.currentTile = 0;
        this.guesses = [];
        this.gameBoard = [];
        this.keyboardState = {};
        this.answerLists = {};
        this.guessLists = {};
        this.possibleAnswers = [];
        this.isGameComplete = false;
        this.sigmoidSlope = 0.01;
        
        this.tileTypes = {
            UNDEFINED: 0,
            SEQUENCE: 1,
            CORRECT: 2,
            MISPLACED: 3,
            INCORRECT: 4,
            EMPTY: 5
        };
        
        this.initialize();
    }
    
    async initialize() {
        await this.loadWordLists();
        this.setupEventListeners();
        this.resetGame();
        this.updateAnalysis();
    }
    
    async loadWordLists() {
        try {
            const [answers6, answers7, answers8, guesses6, guesses7, guesses8] = await Promise.all([
                fetch('answers-6-index.json').then(r => r.json()),
                fetch('answers-7-index.json').then(r => r.json()),
                fetch('answers-8-index.json').then(r => r.json()),
                fetch('guesses-6.json').then(r => r.json()),
                fetch('guesses-7.json').then(r => r.json()),
                fetch('guesses-8.json').then(r => r.json())
            ]);
            
            this.answerLists = {
                6: answers6,
                7: answers7,
                8: answers8
            };
            
            this.guessLists = {
                6: guesses6,
                7: guesses7,
                8: guesses8
            };
            
            console.log('Word lists loaded successfully');
        } catch (error) {
            console.error('Failed to load word lists:', error);
            this.showMessage('Failed to load word data. Please check your connection.');
        }
    }
    
    setupEventListeners() {
        // Game length selector
        document.getElementById('gameLength').addEventListener('change', (e) => {
            this.currentLength = parseInt(e.target.value);
            this.resetGame();
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e.key.toLowerCase());
        });
        
        // On-screen keyboard
        document.getElementById('keyboard').addEventListener('click', (e) => {
            if (e.target.classList.contains('key')) {
                const key = e.target.getAttribute('data-key').toLowerCase();
                this.handleKeyPress(key);
            }
        });
    }
    
    resetGame() {
        this.currentRow = 0;
        this.currentTile = 0;
        this.guesses = [];
        this.gameBoard = [];
        this.keyboardState = {};
        this.isGameComplete = false;
        
        this.createGameBoard();
        this.updateSequenceDisplay();
        this.resetPossibleAnswers();
        this.updateKeyboard();
        this.updateAnalysis();
    }
    
    createGameBoard() {
        const board = document.getElementById('gameBoard');
        board.innerHTML = '';
        board.className = `game-board length-${this.currentLength}`;
        
        const maxRows = 6;
        this.gameBoard = [];
        
        for (let row = 0; row < maxRows; row++) {
            const rowData = [];
            for (let col = 0; col < this.currentLength; col++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.id = `tile-${row}-${col}`;
                board.appendChild(tile);
                rowData.push({ letter: '', type: this.tileTypes.UNDEFINED });
            }
            this.gameBoard.push(rowData);
        }
    }
    
    updateSequenceDisplay() {
        const sequenceDisplay = document.querySelector('.sequence-letters');
        const sequence = this.gameData[this.currentLength].sequence.toUpperCase();
        sequenceDisplay.textContent = sequence;
    }
    
    resetPossibleAnswers() {
        if (!this.answerLists[this.currentLength]) return;
        
        const sequence = this.gameData[this.currentLength].sequence.toLowerCase();
        this.possibleAnswers = Object.keys(this.answerLists[this.currentLength])
            .filter(word => word.toLowerCase().includes(sequence));
        
        console.log(`Initialized with ${this.possibleAnswers.length} possible answers containing "${sequence}"`);
    }
    
    handleKeyPress(key) {
        if (this.isGameComplete) return;
        
        if (key === 'enter') {
            this.submitGuess();
        } else if (key === 'backspace') {
            this.deleteLetter();
        } else if (key === 'blank') {
            this.addLetter(' ');
        } else if (/^[a-z]$/.test(key)) {
            this.addLetter(key.toUpperCase());
        }
    }
    
    addLetter(letter) {
        if (this.currentTile >= this.currentLength) return;
        
        const tileElement = document.getElementById(`tile-${this.currentRow}-${this.currentTile}`);
        tileElement.textContent = letter;
        tileElement.classList.add('filled');
        
        this.gameBoard[this.currentRow][this.currentTile].letter = letter;
        this.currentTile++;
    }
    
    deleteLetter() {
        if (this.currentTile === 0) return;
        
        this.currentTile--;
        const tileElement = document.getElementById(`tile-${this.currentRow}-${this.currentTile}`);
        tileElement.textContent = '';
        tileElement.classList.remove('filled');
        
        this.gameBoard[this.currentRow][this.currentTile].letter = '';
    }
    
    submitGuess() {
        if (this.currentTile !== this.currentLength) {
            this.showMessage('Not enough letters');
            return;
        }
        
        const guess = this.gameBoard[this.currentRow].map(tile => tile.letter).join('').toLowerCase();
        
        // Validate guess contains sequence
        const sequence = this.gameData[this.currentLength].sequence;
        if (!guess.includes(sequence)) {
            this.showMessage(`Guess must contain "${sequence.toUpperCase()}"`);
            return;
        }
        
        // Validate guess is in word list
        if (!this.guessLists[this.currentLength] || !this.guessLists[this.currentLength].includes(guess.toUpperCase())) {
            this.showMessage('Not in word list');
            return;
        }
        
        // Process the guess
        this.processGuess(guess);
        this.guesses.push(guess);
        
        // Update display
        this.updateTileColors(this.currentRow, guess);
        this.updateKeyboard();
        this.filterPossibleAnswers();
        this.updateAnalysis();
        
        // Check win condition
        const hiddenWord = this.gameData[this.currentLength].hiddenWord;
        if (guess === hiddenWord) {
            this.isGameComplete = true;
            this.showMessage('Congratulations! You found the word!');
            return;
        }
        
        // Move to next row
        this.currentRow++;
        this.currentTile = 0;
        
        if (this.currentRow >= 6) {
            this.isGameComplete = true;
            this.showMessage(`Game over! The word was: ${hiddenWord.toUpperCase()}`);
        }
    }
    
    processGuess(guess) {
        const hiddenWord = this.gameData[this.currentLength].hiddenWord;
        const sequence = this.gameData[this.currentLength].sequence;
        const result = this.getGuessResult(sequence, guess, hiddenWord);
        
        // Store the result in the game board
        for (let i = 0; i < this.currentLength; i++) {
            this.gameBoard[this.currentRow][i].type = result.tiles[i].type;
        }
    }
    
    getGuessResult(sequence, guess, answer) {
        const result = {
            tiles: [],
            gameLength: answer.length
        };
        
        // Initialize tiles
        for (let i = 0; i < guess.length; i++) {
            result.tiles.push({
                letter: guess[i],
                type: this.tileTypes.UNDEFINED
            });
        }
        
        const guessSqnceIndex = guess.indexOf(sequence);
        const answerSqnceIndex = answer.indexOf(sequence);
        const sqnceOffset = guessSqnceIndex - answerSqnceIndex;
        const lenOffset = answer.length - guess.length;
        
        let answerData = answer.split('');
        
        // Helper function
        const shouldBreak = (i) => {
            if (sqnceOffset > 0) {
                return i > result.tiles.length + 1 - sqnceOffset;
            }
            return answer.length < i + 1 - sqnceOffset;
        };
        
        // First pass: Set sequence tiles
        for (let i = 0; i < 3; i++) {
            result.tiles[guessSqnceIndex + i].type = this.tileTypes.SEQUENCE;
            answerData[answerSqnceIndex + i] = ' ';
        }
        
        // Second pass: Set empty tiles
        if (sqnceOffset > 0) {
            for (let i = 0; i < sqnceOffset; i++) {
                result.tiles[i].type = this.tileTypes.EMPTY;
            }
        } else if (sqnceOffset + lenOffset < 0) {
            for (let i = 0; i < -sqnceOffset; i++) {
                result.tiles[result.tiles.length + sqnceOffset + i].type = this.tileTypes.EMPTY;
            }
        }
        
        // Third pass: Set correct tiles
        for (let i = 0; i < result.tiles.length; i++) {
            if (shouldBreak(i)) break;
            if (i - sqnceOffset >= 0) {
                if (result.tiles[i].type === this.tileTypes.UNDEFINED && 
                    result.tiles[i].letter === answerData[i - sqnceOffset]) {
                    result.tiles[i].type = this.tileTypes.CORRECT;
                    answerData[i - sqnceOffset] = ' ';
                }
            }
        }
        
        // Fourth pass: Set misplaced tiles
        for (let i = 0; i < result.tiles.length; i++) {
            if (shouldBreak(i)) break;
            if (result.tiles[i].type === this.tileTypes.UNDEFINED) {
                for (let j = 0; j < answerData.length; j++) {
                    if (result.tiles[i].letter === answerData[j]) {
                        result.tiles[i].type = this.tileTypes.MISPLACED;
                        answerData[j] = ' ';
                        break;
                    }
                }
            }
        }
        
        // Fifth pass: Mark remaining as incorrect
        for (let i = 0; i < result.tiles.length; i++) {
            if (shouldBreak(i)) break;
            if (result.tiles[i].type === this.tileTypes.UNDEFINED) {
                result.tiles[i].type = this.tileTypes.INCORRECT;
            }
        }
        
        return result;
    }
    
    updateTileColors(row, guess) {
        for (let col = 0; col < this.currentLength; col++) {
            const tile = document.getElementById(`tile-${row}-${col}`);
            const tileData = this.gameBoard[row][col];
            
            // Remove existing color classes
            tile.classList.remove('correct', 'misplaced', 'incorrect', 'sequence', 'empty');
            
            // Add appropriate color class
            switch (tileData.type) {
                case this.tileTypes.CORRECT:
                    tile.classList.add('correct');
                    break;
                case this.tileTypes.MISPLACED:
                    tile.classList.add('misplaced');
                    break;
                case this.tileTypes.INCORRECT:
                    tile.classList.add('incorrect');
                    break;
                case this.tileTypes.SEQUENCE:
                    tile.classList.add('sequence');
                    break;
                case this.tileTypes.EMPTY:
                    tile.classList.add('empty');
                    break;
            }
        }
    }
    
    updateKeyboard() {
        // Reset keyboard state
        const keys = document.querySelectorAll('.key');
        keys.forEach(key => {
            key.classList.remove('correct', 'misplaced', 'incorrect');
        });
        
        // Update keyboard colors based on guessed letters
        for (const guess of this.guesses) {
            const result = this.getGuessResult(
                this.gameData[this.currentLength].sequence,
                guess,
                this.gameData[this.currentLength].hiddenWord
            );
            
            for (const tile of result.tiles) {
                if (tile.letter === ' ') continue;
                
                const keyElement = document.querySelector(`[data-key="${tile.letter.toUpperCase()}"]`);
                if (!keyElement) continue;
                
                // Only update if this is better information (correct > misplaced > incorrect)
                const currentClasses = keyElement.classList;
                
                if (tile.type === this.tileTypes.CORRECT) {
                    keyElement.classList.remove('misplaced', 'incorrect');
                    keyElement.classList.add('correct');
                } else if (tile.type === this.tileTypes.MISPLACED && !currentClasses.contains('correct')) {
                    keyElement.classList.remove('incorrect');
                    keyElement.classList.add('misplaced');
                } else if (tile.type === this.tileTypes.INCORRECT && 
                          !currentClasses.contains('correct') && 
                          !currentClasses.contains('misplaced')) {
                    keyElement.classList.add('incorrect');
                }
            }
        }
    }
    
    filterPossibleAnswers() {
        if (!this.possibleAnswers.length) return;
        
        const sequence = this.gameData[this.currentLength].sequence;
        const guessResults = this.guesses.map(guess => 
            this.getGuessResult(sequence, guess, this.gameData[this.currentLength].hiddenWord)
        );
        
        this.possibleAnswers = this.possibleAnswers.filter(word => {
            return guessResults.every((result, guessIndex) => {
                return this.validatePossibleAnswer(word, result, guessIndex);
            });
        });
        
        console.log(`Filtered to ${this.possibleAnswers.length} possible answers`);
    }
    
    validatePossibleAnswer(possibleAnswer, result, guessNumber) {
        if (guessNumber === 0 && possibleAnswer.length !== result.gameLength) {
            return false;
        }
        
        const sequence = this.gameData[this.currentLength].sequence;
        
        // Check if sequence is in the possible answer
        if (!possibleAnswer.includes(sequence)) return false;
        
        // Check if sequence is in correct position
        const answerSqnceIndex = possibleAnswer.indexOf(sequence);
        const guessSqnceIndex = this.guesses[guessNumber].indexOf(sequence);
        const sqnceOffset = guessSqnceIndex - answerSqnceIndex;
        
        // Check correct tiles
        for (let i = 0; i < result.tiles.length; i++) {
            const tile = result.tiles[i];
            if (tile.type === this.tileTypes.CORRECT) {
                const answerIndex = i - sqnceOffset;
                if (answerIndex < 0 || answerIndex >= possibleAnswer.length) return false;
                if (tile.letter !== possibleAnswer[answerIndex]) return false;
            }
        }
        
        // Check incorrect tiles
        const modifiedAnswer = possibleAnswer.replace(sequence, '   ');
        for (const tile of result.tiles) {
            if (tile.type === this.tileTypes.INCORRECT) {
                if (modifiedAnswer.includes(tile.letter)) return false;
            }
        }
        
        // Check misplaced tiles
        for (let i = 0; i < result.tiles.length; i++) {
            const tile = result.tiles[i];
            if (tile.type === this.tileTypes.MISPLACED) {
                const answerIndex = i - sqnceOffset;
                if (answerIndex >= 0 && answerIndex < possibleAnswer.length) {
                    if (tile.letter === possibleAnswer[answerIndex]) return false;
                }
                if (!modifiedAnswer.includes(tile.letter)) return false;
            }
        }
        
        return true;
    }
    
    calculateEntropy(probabilities) {
        let entropy = 0;
        for (const p of Object.values(probabilities)) {
            if (p > 0) {
                entropy += -p * Math.log2(p);
            }
        }
        return entropy;
    }
    
    calculateGuessEntropy(guess) {
        if (!this.possibleAnswers.length) return 0;
        
        const sequence = this.gameData[this.currentLength].sequence;
        const distribution = {};
        
        // Calculate frequency-based weights for all possible answers
        const wordWeights = {};
        let totalWeight = 0;
        for (const possibleAnswer of this.possibleAnswers) {
            const weight = this.calculateWordProbability(possibleAnswer);
            wordWeights[possibleAnswer] = weight;
            totalWeight += weight;
        }
        
        for (const possibleAnswer of this.possibleAnswers) {
            const result = this.getGuessResult(sequence, guess, possibleAnswer);
            const hash = this.hashTiles(result.tiles);
            
            if (!distribution[hash]) {
                distribution[hash] = { words: [], totalWeight: 0 };
            }
            distribution[hash].words.push(possibleAnswer);
            distribution[hash].totalWeight += wordWeights[possibleAnswer];
        }
        
        const probabilities = {};
        for (const [hash, data] of Object.entries(distribution)) {
            probabilities[hash] = data.totalWeight / totalWeight;
        }
        
        return this.calculateEntropy(probabilities);
    }
    
    hashTiles(tiles) {
        return tiles.map(tile => `${tile.letter}:${tile.type}`).join('|');
    }
    
    calculateWordProbability(word) {
        if (!this.answerLists[this.currentLength]) return 0.5;
        
        const index = this.answerLists[this.currentLength][word.toLowerCase()] || 999999;
        const cutoff = this.gameData[this.currentLength].cutoff;
        
        // Sigmoid function
        return 1 / (1 + Math.exp(-this.sigmoidSlope * (cutoff - index)));
    }
    
    calculateExpectedScore(word, wordProbability, guessEntropy, previousEntropy) {
        // Calculate x: difference between entropy following previous turn and expected information of guess
        const x = previousEntropy - guessEntropy;
        
        // Upcoming turn (the turn we're about to make, 1-indexed)
        // Use the number of guesses made + 1 to get the upcoming turn number
        // This works correctly whether called before or after currentRow is incremented
        const upcomingTurn = this.guesses.length + 1;
        
        // Calculate expected score using the formula:
        // wordProbability * upcomingTurn + (1 - wordProbability) * (upcomingTurn + 1 + 0.713049 * ln(1 + 0.863437 * x) + 0.056182 * x)
        // If word is correct, we finish on the upcoming turn
        // If word is incorrect, we need at least one more turn plus the expected additional turns based on information gained
        const expectedScore = wordProbability * upcomingTurn + 
                            (1 - wordProbability) * (
                                upcomingTurn + 1 + 
                                0.713049 * Math.log(1 + 0.863437 * x) + 
                                0.056182 * x
                            );
        
        return expectedScore;
    }
    
    updateAnalysis() {
        // Update metrics
        document.getElementById('possibleAnswers').textContent = this.possibleAnswers.length;
        
        const uncertainty = this.possibleAnswers.length > 0 ? Math.log2(this.possibleAnswers.length) : 0;
        document.getElementById('uncertainty').textContent = uncertainty.toFixed(2);
        
        // Calculate information gained
        const baseEntropy = this.possibleAnswers.length > 0 ? Math.log2(this.possibleAnswers.length) : 0;
        let infoGained = 0;
        if (this.guesses.length > 0) {
            const totalPossible = Object.keys(this.answerLists[this.currentLength] || {})
                .filter(word => word.includes(this.gameData[this.currentLength].sequence)).length;
            const originalEntropy = totalPossible > 0 ? Math.log2(totalPossible) : 0;
            infoGained = originalEntropy - baseEntropy;
        }
        document.getElementById('infoGained').textContent = infoGained.toFixed(2);
        
        // Update recommendations
        this.updateRecommendations();
    }
    
    updateRecommendations() {
        if (!this.possibleAnswers.length || this.isGameComplete) {
            document.getElementById('recommendationsList').innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No recommendations available</div>';
            return;
        }
        
        // Calculate raw probabilities for all possible answers
        const rawProbabilities = this.possibleAnswers.map(word => ({
            word,
            rawProbability: this.calculateWordProbability(word)
        }));
        
        // Normalize probabilities to sum to 1
        const totalRawProbability = rawProbabilities.reduce((sum, item) => sum + item.rawProbability, 0);
        const normalizedProbabilities = rawProbabilities.map(item => ({
            word: item.word,
            probability: item.rawProbability / totalRawProbability
        }));
        
        // Calculate current entropy (entropy of the current state)
        const currentEntropy = this.possibleAnswers.length > 0 ? Math.log2(this.possibleAnswers.length) : 0;
        
        // Calculate entropy for each possible answer and expected score
        const recommendations = normalizedProbabilities.map(item => {
            const guessEntropy = this.calculateGuessEntropy(item.word);
            const expectedScore = this.calculateExpectedScore(item.word, item.probability, guessEntropy, currentEntropy);
            
            return {
                word: item.word,
                entropy: guessEntropy,
                probability: item.probability,
                expectedScore: expectedScore
            };
        });
        
        // Sort by expected score (lower is better since it represents expected number of guesses)
        recommendations.sort((a, b) => a.expectedScore - b.expectedScore);
        
        // Display all recommendations
        const listElement = document.getElementById('recommendationsList');
        listElement.innerHTML = '';
        
        for (const rec of recommendations) {
            const div = document.createElement('div');
            div.className = 'recommendation';
            
            // Format probability with tilde for very small values
            let probDisplay;
            if (rec.probability < 0.01 && rec.probability > 0) {
                probDisplay = '~' + rec.probability.toFixed(2);
            } else {
                probDisplay = rec.probability.toFixed(2);
            }
            
            div.innerHTML = `
                <div class="recommendation-word">${rec.word}</div>
                <div class="recommendation-stats">
                    <div class="recommendation-stat">
                        <div class="label">Entropy</div>
                        <div class="value">${rec.entropy.toFixed(2)}</div>
                    </div>
                    <div class="recommendation-stat">
                        <div class="label">Prob</div>
                        <div class="value">${probDisplay}</div>
                    </div>
                    <div class="recommendation-stat">
                        <div class="label">Score</div>
                        <div class="value">${rec.expectedScore.toFixed(2)}</div>
                    </div>
                </div>
            `;
            
            listElement.appendChild(div);
        }
        
        // Verify probabilities sum to 1 (for debugging)
        const probabilitySum = recommendations.reduce((sum, rec) => sum + rec.probability, 0);
        console.log(`Probability sum: ${probabilitySum.toFixed(6)} (should be ~1.000000)`);
    }
    
    showMessage(text) {
        const messageElement = document.getElementById('message');
        messageElement.textContent = text;
        messageElement.style.display = 'block';
        
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 3000);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new SqncesGame();
});