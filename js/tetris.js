// Constants
const COLS = 10;
const ROWS = 20;
const MIN_BLOCK_SIZE = 15;
const MAX_BLOCK_SIZE = 35;
const COLORS = [
    '#000000',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#00FFFF',
    '#FF00FF',
    '#FFA500'
];

// Tetromino shapes
const SHAPES = [
    [],
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[1, 1, 1], [0, 1, 0]],
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1]],
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]]
];

class Tetris {
    constructor() {
        this.canvas = document.getElementById('tetris-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.querySelector('#score span');
        this.levelElement = document.querySelector('#level span');
        this.linesElement = document.querySelector('#lines span');
        
        // Set canvas size
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Game state
        this.reset();
        
        // Sound manager
        this.initSound();
        
        // Initialize leaderboard
        this.leaderboard = JSON.parse(localStorage.getItem('tetrisLeaderboard')) || [];
        
        // Setup menu buttons
        const menu = document.getElementById('menu');
        const startBtn = document.getElementById('start-btn');
        const leaderboardBtn = document.getElementById('leaderboard-btn');
        const quitBtn = document.getElementById('quit-btn');
        const leaderboardDiv = document.getElementById('leaderboard');
        const closeLeaderboardBtn = document.getElementById('close-leaderboard');
        
        // Start button
        startBtn.onclick = () => {
            console.log("Start button clicked");
            // Hide menu and show game area
            menu.classList.add('hidden');
            document.getElementById('game-area').classList.remove('hidden');
            // Reset and start the game
            this.reset();
            this.startGame();
            
            // Focus on canvas to ensure keyboard events work
            this.canvas.focus();
        };
        
        // Leaderboard button
        leaderboardBtn.onclick = () => {
            console.log("Leaderboard button clicked");
            this.showLeaderboard();
        };
        
        // Close leaderboard button
        closeLeaderboardBtn.onclick = () => {
            console.log("Close leaderboard button clicked");
            leaderboardDiv.classList.add('hidden');
            this.showMainMenu();
        };
        
        // Quit button
        quitBtn.onclick = () => {
            console.log("Quit button clicked");
            // Stop all sounds and music
            if (this.bgMusic) {
                this.bgMusic.pause();
                this.bgMusic.currentTime = 0;
            }
            if (this.audioContext) {
                this.audioContext.close();
            }
            
            // Clear the canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Hide all game elements
            document.getElementById('game-area').classList.add('hidden');
            document.getElementById('game-info').classList.add('hidden');
            document.getElementById('mobile-controls').classList.add('hidden');
            document.getElementById('menu').classList.add('hidden');
            document.getElementById('save-score').classList.add('hidden');
            document.getElementById('leaderboard').classList.add('hidden');
            
            // Reset game state
            this.reset();
            
            // Show a goodbye message
            const goodbyeMessage = document.createElement('div');
            goodbyeMessage.id = 'goodbye-message';
            goodbyeMessage.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 24px;
                color: white;
                text-align: center;
                z-index: 1000;
            `;
            goodbyeMessage.textContent = '게임을 종료합니다. 감사합니다!';
            document.body.appendChild(goodbyeMessage);
            
            // Remove the message after 2 seconds
            setTimeout(() => {
                document.body.removeChild(goodbyeMessage);
            }, 2000);
        };

        // Initialize touch controls
        this.initTouchControls();
        
        // iOS audio initialization
        this.initializeAudioForiOS();
    }
    
    initializeAudioForiOS() {
        // Create a dummy audio element to unlock audio on iOS
        const dummyAudio = new Audio();
        dummyAudio.volume = 0;
        
        // Add touch event listener to unlock audio
        const unlockAudio = () => {
            dummyAudio.play().then(() => {
                dummyAudio.pause();
                document.removeEventListener('touchstart', unlockAudio);
            }).catch(() => {
                console.log("Audio unlock failed");
            });
        };
        
        document.addEventListener('touchstart', unlockAudio);
    }
    
    resize() {
        const gameArea = document.getElementById('game-area');
        const scale = window.devicePixelRatio || 1;
        
        // Calculate the maximum possible block size that fits the game area
        const maxWidth = gameArea.clientWidth;
        const maxHeight = gameArea.clientHeight;
        
        // Calculate block size based on available space
        let blockSize = Math.min(
            Math.floor(maxWidth / COLS),
            Math.floor(maxHeight / ROWS)
        );
        
        // Constrain block size within reasonable limits
        blockSize = Math.max(MIN_BLOCK_SIZE, Math.min(blockSize, MAX_BLOCK_SIZE));
        this.blockSize = blockSize;
        
        // Calculate canvas dimensions
        const canvasWidth = COLS * blockSize;
        const canvasHeight = ROWS * blockSize;
        
        // Set canvas size based on calculated block size
        this.canvas.width = canvasWidth * scale;
        this.canvas.height = canvasHeight * scale;
        
        // Scale the context to handle high DPI displays
        this.ctx.scale(scale, scale);
        
        // Set canvas CSS size
        this.canvas.style.width = canvasWidth + 'px';
        this.canvas.style.height = canvasHeight + 'px';
        
        // Center the canvas in the game area
        this.canvas.style.display = 'block';
        this.canvas.style.margin = '0 auto';
    }
    
    reset() {
        // Clear the grid
        this.grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));
        
        // Reset game state
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.paused = false;
        this.dropInterval = 1000;
        this.lastDrop = performance.now();
        
        // Create new piece
        this.piece = this.newPiece();
        
        // Update score display
        this.updateScore();
        
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.draw();
    }
    
    newPiece() {
        const piece = {
            pos: {x: Math.floor(COLS / 2) - 1, y: 0},
            shape: SHAPES[Math.floor(Math.random() * (SHAPES.length - 1)) + 1],
            color: Math.floor(Math.random() * (COLORS.length - 1)) + 1
        };
        
        if (this.collision(piece)) {
            this.gameOver = true;
            return null;
        }
        
        return piece;
    }
    
    collision(piece) {
        if (!piece) return true;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x] !== 0) {
                    const newX = piece.pos.x + x;
                    const newY = piece.pos.y + y;
                    
                    if (newX < 0 || newX >= COLS || newY >= ROWS) {
                        return true;
                    }
                    
                    if (newY >= 0 && this.grid[newY][newX] !== 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    merge(piece) {
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.grid[piece.pos.y + y][piece.pos.x + x] = piece.color;
                }
            });
        });
    }
    
    rotate(piece) {
        if (!piece || this.gameOver || this.paused) {
            console.log("Rotation rejected - game state invalid");
            return false;
        }
        
        // Store the original state
        const originalShape = piece.shape;
        const originalX = piece.pos.x;
        const originalY = piece.pos.y;
        
        // Get dimensions
        const rows = originalShape.length;
        const cols = originalShape[0].length;
        
        // Create new rotated shape
        const rotated = [];
        for (let x = 0; x < cols; x++) {
            const newRow = [];
            for (let y = rows - 1; y >= 0; y--) {
                newRow.push(originalShape[y][x]);
            }
            rotated.push(newRow);
        }
        
        // Try the rotation
        piece.shape = rotated;
        
        // Check for collision
        if (this.collision(piece)) {
            // Try moving left
            piece.pos.x -= 1;
            if (this.collision(piece)) {
                // Try moving right
                piece.pos.x = originalX + 1;
                if (this.collision(piece)) {
                    // Revert to original
                    piece.shape = originalShape;
                    piece.pos.x = originalX;
                    piece.pos.y = originalY;
                    return false;
                }
            }
        }
        
        this.playSound('rotate');
        this.draw();
        return true;
    }
    
    drop() {
        if (!this.piece || this.gameOver || this.paused) {
            console.log("Drop rejected - game state invalid");
            return;
        }
        
        console.log("Dropping piece");
        this.piece.pos.y++;
        if (this.collision(this.piece)) {
            console.log("Drop collision detected, merging piece");
            this.piece.pos.y--;
            this.merge(this.piece);
            this.playSound('drop');
            this.clearLines();
            this.piece = this.newPiece();
            if (this.gameOver) {
                console.log("Game over detected");
                this.playSound('gameover');
                this.showGameOver();
            }
        }
        this.draw(); // Redraw immediately after dropping
    }
    
    quickDrop() {
        if (!this.piece || this.gameOver || this.paused) {
            console.log("Quick drop rejected - game state invalid");
            return;
        }
        
        console.log("Quick dropping piece");
        let dropScore = 0;
        while (!this.collision(this.piece)) {
            this.piece.pos.y++;
            dropScore += 2;
        }
        this.piece.pos.y--;
        this.score += dropScore;
        this.updateScore();
        this.drop();
        this.draw(); // Redraw immediately after quick dropping
    }
    
    move(dir) {
        if (!this.piece || this.gameOver || this.paused) {
            console.log("Move rejected - game state invalid");
            return false;
        }
        
        console.log(`Moving piece ${dir > 0 ? 'right' : 'left'}`);
        this.piece.pos.x += dir;
        if (this.collision(this.piece)) {
            console.log("Move collision detected, reverting");
            this.piece.pos.x -= dir;
            return false;
        }
        this.playSound('move');
        this.draw(); // Redraw immediately after moving
        return true;
    }
    
    clearLines() {
        let linesCleared = 0;
        
        outer: for (let y = ROWS - 1; y >= 0; y--) {
            for (let x = 0; x < COLS; x++) {
                if (this.grid[y][x] === 0) continue outer;
            }
            
            const row = this.grid.splice(y, 1)[0].fill(0);
            this.grid.unshift(row);
            linesCleared++;
            y++;
        }
        
        if (linesCleared > 0) {
            const points = [40, 100, 300, 1200];
            this.score += points[linesCleared - 1] * this.level;
            
            this.lines += linesCleared;
            
            const newLevel = Math.floor(this.lines / 10) + 1;
            if (newLevel !== this.level) {
                this.level = newLevel;
                this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            }
            
            this.playSound('clear');
            this.updateScore();
        }
    }
    
    updateScore() {
        if (this.scoreElement) this.scoreElement.textContent = this.score;
        if (this.levelElement) this.levelElement.textContent = this.level;
        if (this.linesElement) this.linesElement.textContent = this.lines;
    }
    
    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.grid.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.ctx.fillStyle = COLORS[value];
                    this.ctx.fillRect(x * this.blockSize, y * this.blockSize,
                        this.blockSize - 1, this.blockSize - 1);
                }
            });
        });
        
        // Draw current piece
        if (this.piece) {
            this.ctx.fillStyle = COLORS[this.piece.color];
            this.piece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        this.ctx.fillRect(
                            (this.piece.pos.x + x) * this.blockSize,
                            (this.piece.pos.y + y) * this.blockSize,
                            this.blockSize - 1,
                            this.blockSize - 1
                        );
                    }
                });
            });
        }
    }
    
    initSound() {
        this.sounds = {};
        const soundNames = ['move', 'rotate', 'drop', 'clear', 'gameover'];
        
        soundNames.forEach(name => {
            const audio = new Audio(`assets/sounds/${name}.wav`);
            audio.volume = 0.3;
            this.sounds[name] = audio;
        });
    }
    
    playSound(name) {
        if (this.sounds[name]) {
            this.sounds[name].currentTime = 0;
            this.sounds[name].play().catch(() => {});
        }
    }
    
    startGame() {
        console.log("Game started");
        this.gameOver = false;
        this.paused = false;
        this.lastDrop = performance.now();
        
        // Ensure a piece is created
        if (!this.piece) {
            this.piece = this.newPiece();
        }
        
        // Reinitialize touch controls to ensure they're properly connected
        this.initTouchControls();
        
        // Initialize and start background music
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            this.bgMusic = new Audio('assets/sounds/super-mario-bros.mp3');
            this.bgMusic.loop = true;
            this.bgMusic.volume = 0.5;
            
            // iOS compatibility
            this.bgMusic.preload = 'auto';
            
            this.musicSource = this.audioContext.createMediaElementSource(this.bgMusic);
            this.gainNode = this.audioContext.createGain();
            this.musicSource.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
        }
        
        // Start playing the music
        this.audioContext.resume().then(() => {
            this.bgMusic.play().catch(e => {
                console.error("Error playing music:", e);
                // Try to play again after a short delay
                setTimeout(() => {
                    this.bgMusic.play().catch(e => console.error("Second attempt failed:", e));
                }, 1000);
            });
        });
        
        this.draw();
        requestAnimationFrame(time => this.update(time));
    }
    
    showGameOver() {
        const saveScoreDiv = document.getElementById('save-score');
        const finalScoreSpan = saveScoreDiv.querySelector('.final-score');
        const playerNameInput = document.getElementById('player-name');
        const saveYesBtn = document.getElementById('save-yes');
        const saveNoBtn = document.getElementById('save-no');
        
        finalScoreSpan.textContent = this.score;
        saveScoreDiv.classList.remove('hidden');
        
        // Focus on name input
        playerNameInput.value = '';
        playerNameInput.focus();
        
        // Setup save buttons
        saveYesBtn.onclick = () => {
            const playerName = playerNameInput.value.trim() || 'Anonymous';
            this.saveScore(playerName, this.score);
            this.showLeaderboard();
            saveScoreDiv.classList.add('hidden');
        };
        
        saveNoBtn.onclick = () => {
            saveScoreDiv.classList.add('hidden');
            this.showMainMenu();
        };
    }
    
    saveScore(playerName, score) {
        // Add new score
        this.leaderboard.push({ name: playerName, score: score, date: new Date().toISOString() });
        
        // Sort by score (highest first)
        this.leaderboard.sort((a, b) => b.score - a.score);
        
        // Keep only top 10 scores
        if (this.leaderboard.length > 10) {
            this.leaderboard = this.leaderboard.slice(0, 10);
        }
        
        // Save to localStorage
        localStorage.setItem('tetrisLeaderboard', JSON.stringify(this.leaderboard));
    }
    
    showLeaderboard() {
        const menu = document.getElementById('menu');
        const leaderboard = document.getElementById('leaderboard');
        const entries = document.getElementById('leaderboard-entries');
        
        // Hide menu
        menu.classList.add('hidden');
        
        // Clear previous entries
        entries.innerHTML = '';
        
        // Add entries
        this.leaderboard.forEach((entry, index) => {
            const div = document.createElement('div');
            div.className = 'leaderboard-entry';
            div.innerHTML = `
                <span class="rank">${index + 1}</span>
                <span class="name">${entry.name}</span>
                <span class="score">${entry.score}</span>
            `;
            entries.appendChild(div);
        });
        
        // Show leaderboard
        leaderboard.classList.remove('hidden');
    }
    
    showMainMenu() {
        // Stop background music when returning to menu
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
            if (this.audioContext && this.audioContext.suspend) {
                this.audioContext.suspend();
            }
        }
        
        const menu = document.getElementById('menu');
        const gameArea = document.getElementById('game-area');
        const saveScore = document.getElementById('save-score');
        const leaderboard = document.getElementById('leaderboard');
        
        // Hide all other screens
        gameArea.classList.add('hidden');
        saveScore.classList.add('hidden');
        leaderboard.classList.add('hidden');
        
        // Show main menu
        menu.classList.remove('hidden');
        
        // Reset game state
        this.reset();
    }
    
    update(time = 0) {
        // Only update game state if game is active
        if (!this.gameOver && !this.paused && this.piece) {
            const currentTime = performance.now();
            if (currentTime - this.lastDrop > this.dropInterval) {
                console.log("Auto-dropping piece");
                this.drop();
                this.lastDrop = currentTime;
            }
        }
        
        // Always draw the game state
        this.draw();
        
        // Continue the game loop
        requestAnimationFrame(time => this.update(time));
    }
    
    initTouchControls() {
        console.log("Initializing touch controls");
        
        // Left button
        const leftBtn = document.getElementById('left-btn');
        if (leftBtn) {
            leftBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                console.log("Left button touched");
                if (!this.gameOver && !this.paused) {
                    this.move(-1);
                }
            });
            leftBtn.addEventListener('click', () => {
                console.log("Left button clicked");
                if (!this.gameOver && !this.paused) {
                    this.move(-1);
                }
            });
        }

        // Right button
        const rightBtn = document.getElementById('right-btn');
        if (rightBtn) {
            rightBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                console.log("Right button touched");
                if (!this.gameOver && !this.paused) {
                    this.move(1);
                }
            });
            rightBtn.addEventListener('click', () => {
                console.log("Right button clicked");
                if (!this.gameOver && !this.paused) {
                    this.move(1);
                }
            });
        }

        // Down button
        const downBtn = document.getElementById('down-btn');
        if (downBtn) {
            downBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                console.log("Down button touched");
                if (!this.gameOver && !this.paused) {
                    this.drop();
                }
            });
            downBtn.addEventListener('click', () => {
                console.log("Down button clicked");
                if (!this.gameOver && !this.paused) {
                    this.drop();
                }
            });
        }

        // Rotate button
        const rotateBtn = document.getElementById('rotate-btn');
        if (rotateBtn) {
            rotateBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                console.log("Rotate button touched");
                if (!this.gameOver && !this.paused && this.piece) {
                    this.rotate(this.piece);
                }
            });
            rotateBtn.addEventListener('click', () => {
                console.log("Rotate button clicked");
                if (!this.gameOver && !this.paused && this.piece) {
                    this.rotate(this.piece);
                }
            });
        }

        // Drop button
        const dropBtn = document.getElementById('drop-btn');
        if (dropBtn) {
            dropBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                console.log("Drop button touched");
                if (!this.gameOver && !this.paused) {
                    this.quickDrop();
                }
            });
            dropBtn.addEventListener('click', () => {
                console.log("Drop button clicked");
                if (!this.gameOver && !this.paused) {
                    this.quickDrop();
                }
            });
        }
    }
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    const game = new Tetris();
    
    // Show menu initially
    const menu = document.getElementById('menu');
    const startBtn = document.getElementById('start-btn');
    const quitBtn = document.getElementById('quit-btn');
    
    // Keyboard controls
    document.addEventListener('keydown', function(event) {
        console.log("Key pressed:", event.key);
        console.log("Menu hidden:", menu.classList.contains('hidden'));
        console.log("Game over:", game.gameOver);
        
        // Only handle keyboard events when game is active (menu is hidden and not game over)
        if (game.gameOver || !menu.classList.contains('hidden')) {
            console.log("Game over or menu visible - ignoring key press");
            return;
        }
        
        event.preventDefault(); // Prevent default behavior for all game keys
        
        switch (event.key) {
            case 'ArrowLeft':
                console.log("Moving left");
                game.move(-1);
                break;
            case 'ArrowRight':
                console.log("Moving right");
                game.move(1);
                break;
            case 'ArrowDown':
                console.log("Dropping");
                game.drop();
                break;
            case 'ArrowUp':
                console.log("Rotating");
                game.rotate(game.piece);
                break;
            case ' ':
                console.log("Quick dropping");
                game.quickDrop();
                break;
            case 'Escape':
                console.log("Quitting");
                quitBtn.click();
                break;
        }
    });
}); 