/**
 * Snake Game - Classic implementation with modern features
 * Features: Score tracking, local storage, smooth animations, touch controls
 */

class SnakeGame {
  constructor() {
    // Canvas setup
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // Game configuration
    this.gridSize = 20;
    this.tileCount = this.canvas.width / this.gridSize;

    // Game state
    this.snake = [{ x: 10, y: 10 }];
    this.food = this.generateFood();
    this.direction = { x: 0, y: 0 };
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.gameRunning = false;
    this.gameSpeed = 120; // Lower is faster

    // DOM elements
    this.scoreElement = document.getElementById("score");
    this.highScoreElement = document.getElementById("highScore");
    this.overlay = document.getElementById("gameOverlay");
    this.overlayTitle = document.getElementById("overlayTitle");
    this.overlayText = document.getElementById("overlayText");
    this.startButton = document.getElementById("startButton");

    this.init();
  }

  init() {
    this.updateDisplay();
    this.setupEventListeners();
    this.draw(); // Initial draw
  }

  setupEventListeners() {
    // Keyboard controls
    document.addEventListener("keydown", (e) => this.handleKeyPress(e));

    // Start button
    this.startButton.addEventListener("click", () => this.startGame());

    // Touch controls for mobile
    this.setupTouchControls();

    // Prevent default behavior for arrow keys and space
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

      // Add touch feedback
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

  handleKeyPress(e) {
    if (!this.gameRunning && (e.code === "Space" || e.key === " ")) {
      this.startGame();
      return;
    }

    if (!this.gameRunning) return;

    // WASD and Arrow key controls
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
        return; // Invalid move
      }
    }

    this.direction = newDirection;
  }

  startGame() {
    this.gameRunning = true;
    this.snake = [{ x: 10, y: 10 }];
    this.direction = { x: 0, y: 0 };
    this.score = 0;
    this.food = this.generateFood();
    this.gameSpeed = 120;

    this.hideOverlay();
    this.updateDisplay();
    this.gameLoop();
  }

  gameLoop() {
    if (!this.gameRunning) return;

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

    // Increase speed slightly as score increases
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

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
      this.overlayTitle.textContent = "🏆 Neuer Rekord!";
      this.overlayText.textContent = `Glückwunsch! Du hast ${this.score} Punkte erreicht!`;
    } else {
      this.overlayTitle.textContent = "💀 Game Over";
      this.overlayText.textContent = `Du hast ${this.score} Punkte erreicht. Versuche es erneut!`;
    }

    this.startButton.textContent = "Nochmal spielen";
    this.updateDisplay();
    this.showOverlay();
  }

  draw() {
    // Clear canvas with gradient background
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

    // Draw grid (subtle)
    this.drawGrid();

    // Draw food with glow effect
    this.drawFood();

    // Draw snake with gradient
    this.drawSnake();
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

    // Glow effect
    this.ctx.shadowColor = "#e74c3c";
    this.ctx.shadowBlur = 15;

    // Food circle
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

    // Inner highlight
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
        // Head with glow
        this.ctx.shadowColor = "#27ae60";
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = "#2ecc71";
      } else {
        // Body segments with gradient
        this.ctx.shadowBlur = 0;
        const intensity = 1 - (index / this.snake.length) * 0.5;
        this.ctx.fillStyle = `rgba(46, 204, 113, ${intensity})`;
      }

      // Draw rounded rectangle
      this.drawRoundedRect(
        x + 1,
        y + 1,
        this.gridSize - 2,
        this.gridSize - 2,
        4
      );

      if (index === 0) {
        // Draw eyes for the head
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
    this.highScoreElement.textContent = this.highScore;
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

  loadHighScore() {
    return parseInt(localStorage.getItem("snakeHighScore") || "0");
  }

  saveHighScore() {
    localStorage.setItem("snakeHighScore", this.highScore.toString());
  }
}

// Initialize game when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const game = new SnakeGame();

  // Handle window resize for responsive canvas
  window.addEventListener("resize", () => {
    const canvas = document.getElementById("gameCanvas");
    const container = canvas.parentElement;
    const maxWidth = Math.min(400, container.offsetWidth - 40);

    if (maxWidth < 400) {
      canvas.style.width = maxWidth + "px";
      canvas.style.height = maxWidth + "px";
    }
  });

  // Trigger initial resize
  window.dispatchEvent(new Event("resize"));
});

// Prevent scrolling on mobile when using touch controls
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
