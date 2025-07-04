/**
 * Multiplayer Snake Game - Frontend Client
 * Features: Real-time multiplayer, database integration, leaderboard
 */

class MultiplayerSnakeClient {
  constructor() {
    // Canvas setup
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // Game configuration - responsive sizing
    this.baseCanvasSize = 400;
    this.gridSize = 20;
    this.tileCount = this.canvas.width / this.gridSize;

    // Game state
    this.gameMode = null;
    this.playerName = "";
    this.playerId = null;
    this.socket = null;
    this.gameRunning = false;
    this.isMultiplayer = false;

    // Local game state (for singleplayer)
    this.snake = [{ x: 10, y: 10 }];
    this.food = this.generateFood();
    this.direction = { x: 0, y: 0 };
    this.score = 0;
    this.gameSpeed = 120;

    // Multiplayer state
    this.players = new Map();
    this.roomId = null;

    // DOM elements
    this.loginScreen = document.getElementById("loginScreen");
    this.gameMain = document.getElementById("gameMain");
    this.leaderboardSection = document.getElementById("leaderboardSection");
    this.multiplayerInfo = document.getElementById("multiplayerInfo");

    this.playerNameInput = document.getElementById("playerName");
    this.joinGameButton = document.getElementById("joinGameButton");
    this.startButton = document.getElementById("startButton");
    this.backToMenuButton = document.getElementById("backToMenuButton");

    this.scoreElement = document.getElementById("score");
    this.highScoreElement = document.getElementById("highScore");
    this.overlay = document.getElementById("gameOverlay");
    this.overlayTitle = document.getElementById("overlayTitle");
    this.overlayText = document.getElementById("overlayText");

    this.connectionStatus = document.getElementById("connectionStatus");
    this.statusText = document.getElementById("statusText");
    this.playersCount = document.getElementById("playersCount");
    this.currentPlayerName = document.getElementById("currentPlayerName");

    this.init();
  }
  setupCanvasSize() {
    // Calculate responsive canvas size
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );

    let maxSize;
    if (isFullscreen) {
      // Vollbild-Modus: Größeren Canvas verwenden
      maxSize = Math.min(
        window.innerWidth * 0.8,
        window.innerHeight * 0.8,
        800 // Maximale Größe im Vollbild
      );
    } else {
      // Normaler Modus
      maxSize = Math.min(
        window.innerWidth * 0.9,
        window.innerHeight * 0.6,
        this.baseCanvasSize
      );
    }

    // Ensure canvas size is divisible by grid size for perfect alignment
    const adjustedSize = Math.floor(maxSize / this.gridSize) * this.gridSize;

    this.canvas.width = adjustedSize;
    this.canvas.height = adjustedSize;

    // Set CSS size for crisp rendering
    this.canvas.style.width = adjustedSize + "px";
    this.canvas.style.height = adjustedSize + "px";

    // Update tile count
    this.tileCount = adjustedSize / this.gridSize;
  }

  async init() {
    this.setupEventListeners();
    this.setupCanvasSize(); // Setup canvas size after DOM is ready
    this.connectToServer();
    await this.loadLeaderboard();
    this.draw();
  }

  connectToServer() {
    // Verhindere mehrfache Verbindungen
    if (this.socket && this.socket.connected) {
      return;
    }

    // Connect to Socket.IO server
    this.socket = io({
      // Verhindere automatische Reconnection bei page reload
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.updateConnectionStatus("connected", "Verbunden");
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      this.updateConnectionStatus("disconnected", "Verbindung getrennt");

      // Nur reconnecten wenn es nicht durch user action war
      if (reason !== "io client disconnect") {
        this.updateConnectionStatus("connecting", "Verbinde neu...");
      }
    });

    this.socket.on("connect_error", (error) => {
      console.log("Connection error:", error);
      this.updateConnectionStatus("error", "Verbindungsfehler");
    });

    this.socket.on("player-joined", (data) => {
      this.playerId = data.playerId;
      this.playerName = data.playerName;
      this.gameMode = data.gameMode;

      this.currentPlayerName.textContent = this.playerName;
      this.showGameScreen();
    });

    this.socket.on("player-count-update", (data) => {
      this.playersCount.textContent = data.total;
    });

    this.socket.on("room-update", (data) => {
      this.updateWaitingRoom(data);
    });

    this.socket.on("game-started", (data) => {
      this.startSinglePlayerGame(data);
    });

    this.socket.on("multiplayer-game-started", (data) => {
      this.startMultiplayerGame(data);
    });

    this.socket.on("game-update", (data) => {
      this.updateMultiplayerGame(data);
    });

    this.socket.on("multiplayer-game-ended", (data) => {
      this.endMultiplayerGame(data);
    });

    this.socket.on("player-disconnected", (data) => {
      this.handlePlayerDisconnect(data);
    });

    this.socket.on("score-saved", () => {
      this.loadLeaderboard();
    });

    this.socket.on("player-respawned", (data) => {
      if (data.playerId === this.playerId) {
        // Eigener Respawn
        this.snake = data.snake;
        this.food = data.food;
        this.score = 0;
        this.direction = { x: 0, y: 0 };
        this.gameRunning = true;
        this.hideOverlay();
        this.updateDisplay();
      } else {
        // Anderer Spieler respawned
        const player = this.players.get(data.playerId);
        if (player) {
          player.snake = data.snake;
          player.isAlive = true;
          player.score = 0;
          this.updateOtherPlayersDisplay();
        }
      }
    });

    this.socket.on("player-died", (data) => {
      console.log(`💀 ${data.playerName} ist gestorben! Score: ${data.score}`);
      const player = this.players.get(data.playerId);
      if (player) {
        player.isAlive = false;
        this.updateOtherPlayersDisplay();
      }
    });
  }

  setupEventListeners() {
    // Player name input
    this.playerNameInput.addEventListener("input", () => {
      const name = this.playerNameInput.value.trim();
      this.joinGameButton.disabled = name.length < 2;
    });

    this.playerNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !this.joinGameButton.disabled) {
        this.joinGame();
      }
    });

    // Game mode selection
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".mode-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        this.gameMode = btn.dataset.mode;
      });
    });

    // Join game button
    this.joinGameButton.addEventListener("click", () => {
      this.joinGame();
    });

    // Start game button
    this.startButton.addEventListener("click", () => {
      this.startGame();
    });

    // Back to menu button
    this.backToMenuButton.addEventListener("click", () => {
      this.backToMenu();
    });

    // Keyboard controls
    document.addEventListener("keydown", (e) => this.handleKeyPress(e));

    // Touch controls
    this.setupTouchControls();

    // Leaderboard tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.loadLeaderboard(btn.dataset.tab);
      });
    });

    // Prevent default behavior for game keys
    document.addEventListener("keydown", (e) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code
        )
      ) {
        e.preventDefault();
      }
    });
  }

  setupTouchControls() {
    const controlButtons = document.querySelectorAll(".control-btn");

    controlButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const direction = button.dataset.direction;
        this.setDirection(direction);
      });

      button.addEventListener("touchstart", (e) => {
        e.preventDefault();
        button.style.background = "rgba(255, 255, 255, 0.4)";
      });

      button.addEventListener("touchend", (e) => {
        e.preventDefault();
        button.style.background = "rgba(255, 255, 255, 0.2)";
      });
    });
  }

  updateConnectionStatus(status, text) {
    const statusDot = document.querySelector(".status-dot");
    statusDot.className = `status-dot ${status}`;
    this.statusText.textContent = text;
  }

  joinGame() {
    const playerName = this.playerNameInput.value.trim();
    if (playerName.length < 2 || !this.gameMode) return;

    this.socket.emit("join-game", {
      playerName: playerName,
      gameMode: this.gameMode,
    });
  }

  showGameScreen() {
    this.loginScreen.style.display = "none";
    this.gameMain.style.display = "block";

    if (this.gameMode === "multiplayer") {
      this.multiplayerInfo.style.display = "block";
      this.isMultiplayer = true;
    }
  }

  startGame() {
    if (
      this.isMultiplayer &&
      this.startButton.textContent.includes("Respawn")
    ) {
      // Respawn im Multiplayer
      this.respawnPlayer();
    } else if (this.startButton.textContent.includes("Nochmal")) {
      // Singleplayer Neustart - sauberer Reset
      this.resetSinglePlayerGame();
    } else {
      // Normaler Spielstart - Vollbild aktivieren
      this.requestFullscreen();
      this.socket.emit("start-game");
    }
  }

  resetSinglePlayerGame() {
    // Game state zurücksetzen
    this.gameRunning = false;
    this.snake = [{ x: 10, y: 10 }];
    this.food = this.generateFood();
    this.direction = { x: 0, y: 0 };
    this.score = 0;
    this.gameSpeed = 120;

    // UI zurücksetzen
    this.startButton.textContent = "Spiel starten";
    this.backToMenuButton.style.display = "none";
    this.hideOverlay();

    // Vollbild aktivieren und Spiel starten
    this.requestFullscreen();
    this.socket.emit("start-game");
  }

  requestFullscreen() {
    const container = this.canvas.parentElement.parentElement; // game-container

    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen();
    }

    // Event Listener für Vollbild-Änderungen
    document.addEventListener("fullscreenchange", () =>
      this.handleFullscreenChange()
    );
    document.addEventListener("webkitfullscreenchange", () =>
      this.handleFullscreenChange()
    );
    document.addEventListener("msfullscreenchange", () =>
      this.handleFullscreenChange()
    );
  }

  handleFullscreenChange() {
    const isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );

    if (isFullscreen) {
      // Vollbild aktiviert
      document.body.classList.add("fullscreen-mode");

      // Mobile Optimierungen für Vollbild
      if (window.innerWidth <= 768) {
        // Verstecke Adressleiste auf Mobile Geräten
        setTimeout(() => {
          window.scrollTo(0, 1);
          this.setupCanvasSize();
          this.draw();
        }, 100);

        // Mobile Orientierung Event Listener
        if (window.screen && window.screen.orientation) {
          window.screen.orientation.addEventListener("change", () => {
            setTimeout(() => {
              this.setupCanvasSize();
              this.draw();
            }, 100);
          });
        }
      } else {
        this.setupCanvasSize();
        this.draw();
      }
    } else {
      // Vollbild deaktiviert
      document.body.classList.remove("fullscreen-mode");
      this.setupCanvasSize();
      this.draw();
    }
  }

  startSinglePlayerGame(data) {
    this.gameRunning = true;
    this.isMultiplayer = false;

    this.snake = data.initialState.snake;
    this.food = data.initialState.food;
    this.score = data.initialState.score;
    this.direction = { x: 0, y: 0 };
    this.gameSpeed = 120;

    this.hideOverlay();
    this.updateDisplay();
    this.gameLoop();
  }

  startMultiplayerGame(data) {
    this.gameRunning = true;
    this.isMultiplayer = true;

    // Vollbild aktivieren für Multiplayer
    this.requestFullscreen();

    // Update players map
    this.players.clear();
    data.players.forEach((player) => {
      this.players.set(player.id, player);
      if (player.id === this.playerId) {
        this.snake = player.snake;
        this.food = player.food;
        this.score = player.score;
      }
    });

    this.hideOverlay();
    this.updateDisplay();
    this.draw();
  }

  updateMultiplayerGame(data) {
    if (!this.isMultiplayer) return;

    // Update all players
    data.players.forEach((player) => {
      this.players.set(player.id, player);
      if (player.id === this.playerId) {
        this.snake = player.snake;
        this.food = player.food;
        this.score = player.score;
      }
    });

    this.updateDisplay();
    this.updateOtherPlayersDisplay();
    this.draw();
  }

  endMultiplayerGame(data) {
    this.gameRunning = false;

    let resultText = "Spiel beendet!\n\nErgebnisse:\n";
    data.results.forEach((result, index) => {
      const position =
        index === 0
          ? "🥇"
          : index === 1
          ? "🥈"
          : index === 2
          ? "🥉"
          : `${index + 1}.`;
      resultText += `${position} ${result.name}: ${result.score} Punkte\n`;
    });

    this.overlayTitle.textContent = "🏁 Multiplayer Spiel beendet";

    // Use innerHTML instead of textContent to preserve line breaks
    this.overlayText.innerHTML = resultText.replace(/\n/g, "<br>");

    this.startButton.textContent = "Neues Spiel starten";
    this.backToMenuButton.style.display = "inline-block";

    this.showOverlay();
    this.loadLeaderboard();
  }

  gameLoop() {
    if (!this.gameRunning || this.isMultiplayer) return;

    setTimeout(() => {
      this.update();
      this.draw();
      this.gameLoop();
    }, this.gameSpeed);
  }

  update() {
    if (this.direction.x === 0 && this.direction.y === 0) return;

    const head = { ...this.snake[0] };
    head.x += this.direction.x;
    head.y += this.direction.y;

    // Check wall collision
    if (
      head.x < 0 ||
      head.x >= this.tileCount ||
      head.y < 0 ||
      head.y >= this.tileCount
    ) {
      this.gameOver();
      return;
    }

    // Check self collision
    if (
      this.snake.some((segment) => segment.x === head.x && segment.y === head.y)
    ) {
      this.gameOver();
      return;
    }

    // Check collision with other players (nur Kopf gegen Snake-Körper)
    if (this.isMultiplayer) {
      let collisionWithOtherPlayer = false;
      this.players.forEach((player, playerId) => {
        if (playerId !== this.playerId && player.isAlive && player.snake) {
          // Prüfe ob MEIN Kopf auf DEREN Snake trifft
          if (
            player.snake.some(
              (segment) => segment.x === head.x && segment.y === head.y
            )
          ) {
            collisionWithOtherPlayer = true;
            console.log(`💥 Kollision mit ${player.name}!`);
          }
        }
      });

      if (collisionWithOtherPlayer) {
        this.gameOver();
        return;
      }
    }

    this.snake.unshift(head);

    // Check food collision
    if (head.x === this.food.x && head.y === this.food.y) {
      this.eatFood();
    } else {
      this.snake.pop();
    }
  }

  eatFood() {
    this.score += 10;
    this.food = this.generateFood();

    // Increase speed
    if (this.score % 50 === 0 && this.gameSpeed > 60) {
      this.gameSpeed -= 5;
    }

    this.updateDisplay();
    this.animateScoreUpdate();
  }

  generateFood() {
    let food;
    do {
      food = {
        x: Math.floor(Math.random() * this.tileCount),
        y: Math.floor(Math.random() * this.tileCount),
      };
    } while (
      this.snake.some((segment) => segment.x === food.x && segment.y === food.y)
    );

    return food;
  }

  gameOver() {
    this.gameRunning = false;

    // Save score to server
    this.socket.emit("game-over", { score: this.score });

    if (this.isMultiplayer) {
      // Multiplayer Respawn System
      this.overlayTitle.textContent = "💀 Du bist gestorben!";
      this.overlayText.textContent = `Score: ${this.score} Punkte`;
      this.startRespawnCountdown();
    } else {
      // Singleplayer Game Over
      this.overlayTitle.textContent = "💀 Game Over";
      this.overlayText.textContent = `Du hast ${this.score} Punkte erreicht!`;
      this.startButton.textContent = "Nochmal spielen";
      this.backToMenuButton.style.display = "inline-block";
    }

    this.showOverlay();
  }

  startRespawnCountdown() {
    let countdown = 10;
    this.startButton.style.display = "none";
    this.backToMenuButton.style.display = "inline-block";

    const countdownInterval = setInterval(() => {
      if (countdown > 0) {
        this.overlayText.textContent = `Score: ${this.score} Punkte\n\nRespawn in ${countdown} Sekunden...`;
        countdown--;
      } else {
        clearInterval(countdownInterval);
        this.showRespawnButton();
      }
    }, 1000);
  }

  showRespawnButton() {
    this.overlayText.textContent = `Score: ${this.score} Punkte\n\nDu kannst wieder ins Spiel!`;
    this.startButton.textContent = "🔄 Respawn";
    this.startButton.style.display = "inline-block";

    // Auto-respawn after 5 more seconds if not clicked
    setTimeout(() => {
      if (!this.gameRunning && this.isMultiplayer) {
        this.respawnPlayer();
      }
    }, 5000);
  }

  respawnPlayer() {
    if (!this.isMultiplayer) return;

    // Reset player state
    this.score = 0;
    this.direction = { x: 0, y: 0 };

    // Send respawn request to server
    this.socket.emit("player-respawn");

    this.hideOverlay();
    this.gameRunning = true;
    this.updateDisplay();
  }

  handleKeyPress(e) {
    // ESC zum Verlassen des Vollbildmodus
    if (e.code === "Escape") {
      if (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      ) {
        this.exitFullscreen();
      }
      return;
    }

    if (!this.gameRunning && (e.code === "Space" || e.key === " ")) {
      this.startGame();
      return;
    }

    if (!this.gameRunning) return;

    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        this.setDirection("up");
        break;
      case "ArrowDown":
      case "KeyS":
        this.setDirection("down");
        break;
      case "ArrowLeft":
      case "KeyA":
        this.setDirection("left");
        break;
      case "ArrowRight":
      case "KeyD":
        this.setDirection("right");
        break;
    }
  }

  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }

  setDirection(dir) {
    if (!this.gameRunning) return;

    const directions = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    const newDirection = directions[dir];

    // Prevent reversing into itself
    if (this.snake.length > 1) {
      const head = this.snake[0];
      const neck = this.snake[1];
      const nextHead = {
        x: head.x + newDirection.x,
        y: head.y + newDirection.y,
      };

      if (nextHead.x === neck.x && nextHead.y === neck.y) {
        return;
      }
    }

    this.direction = newDirection;

    // Send movement to server in multiplayer
    if (this.isMultiplayer) {
      this.socket.emit("player-move", dir);
    }
  }

  draw() {
    // Clear canvas
    const gradient = this.ctx.createLinearGradient(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    gradient.addColorStop(0, "#2c3e50");
    gradient.addColorStop(1, "#34495e");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawGrid();

    if (this.isMultiplayer) {
      this.drawMultiplayerGame();
    } else {
      this.drawFood();
      this.drawSnake();
    }
  }

  drawMultiplayerGame() {
    // Draw all players
    this.players.forEach((player, playerId) => {
      if (playerId === this.playerId) {
        // Draw own snake and food
        this.drawFood();
        this.drawSnake();
      } else {
        // Draw other players' snakes
        this.drawOtherPlayerSnake(player);
      }
    });
  }

  drawOtherPlayerSnake(player) {
    if (!player.snake || !player.isAlive) return;

    player.snake.forEach((segment, index) => {
      const x = segment.x * this.gridSize;
      const y = segment.y * this.gridSize;

      if (index === 0) {
        // Other player's head
        this.ctx.shadowColor = "#e74c3c";
        this.ctx.shadowBlur = 5;
        this.ctx.fillStyle = "#e74c3c";
      } else {
        // Other player's body
        this.ctx.shadowBlur = 0;
        const intensity = 1 - (index / player.snake.length) * 0.5;
        this.ctx.fillStyle = `rgba(231, 76, 60, ${intensity})`;
      }

      this.drawRoundedRect(
        x + 1,
        y + 1,
        this.gridSize - 2,
        this.gridSize - 2,
        3
      );
    });

    this.ctx.shadowBlur = 0;
  }

  drawGrid() {
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= this.tileCount; i++) {
      const pos = i * this.gridSize;
      this.ctx.beginPath();
      this.ctx.moveTo(pos, 0);
      this.ctx.lineTo(pos, this.canvas.height);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(0, pos);
      this.ctx.lineTo(this.canvas.width, pos);
      this.ctx.stroke();
    }
  }

  drawFood() {
    const x = this.food.x * this.gridSize;
    const y = this.food.y * this.gridSize;

    this.ctx.shadowColor = "#e74c3c";
    this.ctx.shadowBlur = 15;

    this.ctx.fillStyle = "#e74c3c";
    this.ctx.beginPath();
    this.ctx.arc(
      x + this.gridSize / 2,
      y + this.gridSize / 2,
      this.gridSize / 2 - 2,
      0,
      2 * Math.PI
    );
    this.ctx.fill();

    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = "#ff6b6b";
    this.ctx.beginPath();
    this.ctx.arc(
      x + this.gridSize / 2 - 2,
      y + this.gridSize / 2 - 2,
      this.gridSize / 4,
      0,
      2 * Math.PI
    );
    this.ctx.fill();
  }

  drawSnake() {
    this.snake.forEach((segment, index) => {
      const x = segment.x * this.gridSize;
      const y = segment.y * this.gridSize;

      if (index === 0) {
        this.ctx.shadowColor = "#27ae60";
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = "#2ecc71";
      } else {
        this.ctx.shadowBlur = 0;
        const intensity = 1 - (index / this.snake.length) * 0.5;
        this.ctx.fillStyle = `rgba(46, 204, 113, ${intensity})`;
      }

      this.drawRoundedRect(
        x + 1,
        y + 1,
        this.gridSize - 2,
        this.gridSize - 2,
        4
      );

      if (index === 0) {
        // Draw eyes
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = "#fff";
        const eyeSize = 3;
        const eyeOffset = 5;

        this.ctx.fillRect(x + eyeOffset, y + eyeOffset, eyeSize, eyeSize);
        this.ctx.fillRect(
          x + this.gridSize - eyeOffset - eyeSize,
          y + eyeOffset,
          eyeSize,
          eyeSize
        );
      }
    });

    this.ctx.shadowBlur = 0;
  }

  drawRoundedRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height
    );
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fill();
  }

  updateDisplay() {
    this.scoreElement.textContent = this.score;
  }

  updateOtherPlayersDisplay() {
    const otherPlayersContainer = document.getElementById("otherPlayers");
    otherPlayersContainer.innerHTML = "";

    this.players.forEach((player, playerId) => {
      if (playerId !== this.playerId) {
        const playerDiv = document.createElement("div");
        playerDiv.className = `other-player ${
          player.isAlive ? "alive" : "dead"
        }`;
        playerDiv.innerHTML = `
                    <div class="player-name">${player.name}</div>
                    <div class="player-score">${player.score} Punkte</div>
                `;
        otherPlayersContainer.appendChild(playerDiv);
      }
    });
  }

  updateWaitingRoom(data) {
    const waitingPlayers = document.getElementById("waitingPlayers");
    waitingPlayers.innerHTML = "";

    data.players.forEach((player) => {
      const playerSpan = document.createElement("span");
      playerSpan.className = "waiting-player";
      playerSpan.textContent = player.name;
      waitingPlayers.appendChild(playerSpan);
    });

    if (data.players.length >= 2) {
      document.getElementById("multiplayerWaiting").style.display = "block";
    }
  }

  animateScoreUpdate() {
    const scoreContainer = document.querySelector(".score");
    scoreContainer.classList.add("score-update");
    setTimeout(() => {
      scoreContainer.classList.remove("score-update");
    }, 500);
  }

  showOverlay() {
    this.overlay.classList.remove("hidden");
  }

  hideOverlay() {
    this.overlay.classList.add("hidden");
  }

  backToMenu() {
    // Sauber disconnecten bevor reload
    if (this.socket && this.socket.connected) {
      this.socket.emit("player-leave");
      this.socket.disconnect();
    }

    // Vollbild beenden falls aktiv
    this.exitFullscreen();

    // Kurz warten dann reload
    setTimeout(() => {
      location.reload();
    }, 100);
  }

  async loadLeaderboard(tab = "global") {
    try {
      const response = await fetch(`/api/leaderboard/${tab}`);
      const data = await response.json();
      this.displayLeaderboard(data);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    }
  }

  displayLeaderboard(scores) {
    const content = document.getElementById("leaderboardContent");

    if (scores.length === 0) {
      content.innerHTML = '<div class="loading">Keine Scores verfügbar</div>';
      return;
    }

    content.innerHTML = scores
      .map((score, index) => {
        const rankClass = index < 3 ? `rank-${index + 1}` : "";
        return `
                <div class="leaderboard-entry ${rankClass}">
                    <span class="rank">#${index + 1}</span>
                    <span class="name">${score.name}</span>
                    <span class="score">${score.score}</span>
                </div>
            `;
      })
      .join("");
  }

  handlePlayerDisconnect(data) {
    console.log(`Player ${data.playerName} disconnected`);
    this.players.delete(data.playerId);
    this.updateOtherPlayersDisplay();
  }
}

// Initialize game when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const game = new MultiplayerSnakeClient();

  // Handle window resize with throttling
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      game.setupCanvasSize();
      game.draw();
    }, 250);
  });
});

// Prevent scrolling on mobile
document.addEventListener(
  "touchstart",
  (e) => {
    if (e.target.classList.contains("control-btn")) {
      e.preventDefault();
    }
  },
  { passive: false }
);

document.addEventListener(
  "touchmove",
  (e) => {
    if (e.target.closest(".game-container")) {
      e.preventDefault();
    }
  },
  { passive: false }
);
