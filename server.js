const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const Database = require("./database");

class MultiplayerSnakeServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIO(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.database = new Database();
    this.players = new Map();
    this.gameRooms = new Map();
    this.gameConfig = {
      gridSize: 20,
      tileCount: 20,
      gameSpeed: 120,
      maxPlayers: 4,
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname)));
  }

  setupRoutes() {
    // Serve static files
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "index.html"));
    });

    // API Routes
    this.app.get("/api/leaderboard/global", async (req, res) => {
      try {
        const scores = await this.database.getGlobalLeaderboard();
        res.json(scores);
      } catch (error) {
        console.error("Error fetching global leaderboard:", error);
        res.status(500).json({ error: "Database error" });
      }
    });

    this.app.get("/api/leaderboard/session", (req, res) => {
      const sessionScores = Array.from(this.players.values())
        .filter((player) => player.bestScore > 0)
        .map((player) => ({
          name: player.name,
          score: player.bestScore,
          timestamp: player.lastGameTime,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      res.json(sessionScores);
    });

    this.app.post("/api/score", async (req, res) => {
      try {
        const { playerName, score } = req.body;
        await this.database.saveScore(playerName, score);
        res.json({ success: true });
      } catch (error) {
        console.error("Error saving score:", error);
        res.status(500).json({ error: "Failed to save score" });
      }
    });
  }

  setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`Player connected: ${socket.id}`);

      // Error handling für Socket Events
      socket.on("error", (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });

      socket.on("join-game", (data) => {
        try {
          this.handlePlayerJoin(socket, data);
        } catch (error) {
          console.error(`Error in join-game for ${socket.id}:`, error);
        }
      });

      socket.on("player-move", (direction) => {
        try {
          this.handlePlayerMove(socket, direction);
        } catch (error) {
          console.error(`Error in player-move for ${socket.id}:`, error);
        }
      });

      socket.on("start-game", () => {
        try {
          this.handleStartGame(socket);
        } catch (error) {
          console.error(`Error in start-game for ${socket.id}:`, error);
        }
      });

      socket.on("game-over", (data) => {
        try {
          this.handleGameOver(socket, data);
        } catch (error) {
          console.error(`Error in game-over for ${socket.id}:`, error);
        }
      });

      socket.on("player-respawn", () => {
        try {
          this.handlePlayerRespawn(socket);
        } catch (error) {
          console.error(`Error in player-respawn for ${socket.id}:`, error);
        }
      });

      socket.on("player-leave", () => {
        try {
          this.handlePlayerLeave(socket);
        } catch (error) {
          console.error(`Error in player-leave for ${socket.id}:`, error);
        }
      });

      socket.on("disconnect", () => {
        try {
          this.handlePlayerDisconnect(socket);
        } catch (error) {
          console.error(`Error in disconnect for ${socket.id}:`, error);
        }
      });
    });
  }

  handlePlayerJoin(socket, data) {
    const { playerName, gameMode } = data;

    const player = {
      id: socket.id,
      name: playerName,
      gameMode: gameMode,
      score: 0,
      bestScore: 0,
      isAlive: true,
      snake: [{ x: 10, y: 10 }],
      direction: { x: 0, y: 0 },
      food: this.generateFood(),
      lastGameTime: null,
    };

    this.players.set(socket.id, player);

    if (gameMode === "multiplayer") {
      this.assignToGameRoom(socket, player);
    }

    socket.emit("player-joined", {
      playerId: socket.id,
      playerName: playerName,
      gameMode: gameMode,
    });

    this.broadcastPlayerCount();
  }

  assignToGameRoom(socket, player) {
    // Find or create a game room
    let roomId = null;

    for (const [id, room] of this.gameRooms) {
      if (
        room.players.length < this.gameConfig.maxPlayers &&
        !room.gameStarted
      ) {
        roomId = id;
        break;
      }
    }

    if (!roomId) {
      roomId = uuidv4();
      this.gameRooms.set(roomId, {
        id: roomId,
        players: [],
        gameStarted: false,
        gameState: null,
      });
    }

    const room = this.gameRooms.get(roomId);
    room.players.push(player);
    player.roomId = roomId;

    socket.join(roomId);

    // Notify room about new player
    this.io.to(roomId).emit("room-update", {
      roomId: roomId,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isAlive: p.isAlive,
      })),
    });
  }

  handlePlayerMove(socket, direction) {
    const player = this.players.get(socket.id);
    if (!player || !player.isAlive) return;

    const directions = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    const newDirection = directions[direction];
    if (!newDirection) return;

    // Prevent reversing into itself
    if (player.snake.length > 1) {
      const head = player.snake[0];
      const neck = player.snake[1];
      const nextHead = {
        x: head.x + newDirection.x,
        y: head.y + newDirection.y,
      };

      if (nextHead.x === neck.x && nextHead.y === neck.y) {
        return;
      }
    }

    player.direction = newDirection;

    // Broadcast movement in multiplayer
    if (player.gameMode === "multiplayer" && player.roomId) {
      socket.to(player.roomId).emit("player-moved", {
        playerId: socket.id,
        direction: direction,
        snake: player.snake,
      });
    }
  }

  handleStartGame(socket) {
    const player = this.players.get(socket.id);
    if (!player) return;

    if (player.gameMode === "singleplayer") {
      this.startSinglePlayerGame(socket, player);
    } else if (player.gameMode === "multiplayer") {
      this.startMultiplayerGame(socket, player);
    }
  }

  startSinglePlayerGame(socket, player) {
    player.score = 0;
    player.isAlive = true;
    player.snake = [{ x: 10, y: 10 }];
    player.direction = { x: 0, y: 0 };
    player.food = this.generateFood();

    socket.emit("game-started", {
      gameMode: "singleplayer",
      initialState: {
        snake: player.snake,
        food: player.food,
        score: player.score,
      },
    });
  }

  startMultiplayerGame(socket, player) {
    const room = this.gameRooms.get(player.roomId);
    if (!room || room.gameStarted) return;

    // Start game if enough players (minimum 2)
    if (room.players.length >= 2) {
      room.gameStarted = true;

      // Initialize all players in room
      room.players.forEach((p, index) => {
        p.score = 0;
        p.isAlive = true;
        p.snake = [this.getStartPosition(index)];
        p.direction = { x: 0, y: 0 };
        p.food = this.generateFood();
      });

      this.io.to(player.roomId).emit("multiplayer-game-started", {
        players: room.players.map((p) => ({
          id: p.id,
          name: p.name,
          snake: p.snake,
          food: p.food,
          score: p.score,
        })),
      });

      // Start game loop for this room
      this.startGameLoop(player.roomId);
    }
  }

  getStartPosition(playerIndex) {
    const positions = [
      { x: 5, y: 5 }, // Player 1
      { x: 15, y: 5 }, // Player 2
      { x: 5, y: 15 }, // Player 3
      { x: 15, y: 15 }, // Player 4
    ];
    return positions[playerIndex] || positions[0];
  }

  startGameLoop(roomId) {
    const room = this.gameRooms.get(roomId);
    if (!room || !room.gameStarted) return;

    const gameLoop = setInterval(() => {
      const alivePlayers = room.players.filter((p) => p.isAlive);

      if (alivePlayers.length === 0) {
        clearInterval(gameLoop);
        this.endMultiplayerGame(roomId);
        return;
      }

      // Update each alive player
      alivePlayers.forEach((player) => {
        this.updatePlayerState(player);
      });

      // Broadcast game state
      this.io.to(roomId).emit("game-update", {
        players: room.players.map((p) => ({
          id: p.id,
          name: p.name,
          snake: p.snake,
          food: p.food,
          score: p.score,
          isAlive: p.isAlive,
        })),
      });
    }, this.gameConfig.gameSpeed);

    room.gameLoop = gameLoop;
  }

  updatePlayerState(player) {
    if (player.direction.x === 0 && player.direction.y === 0) return;

    const head = { ...player.snake[0] };
    head.x += player.direction.x;
    head.y += player.direction.y;

    // Check wall collision
    if (
      head.x < 0 ||
      head.x >= this.gameConfig.tileCount ||
      head.y < 0 ||
      head.y >= this.gameConfig.tileCount
    ) {
      player.isAlive = false;
      console.log(`${player.name} hit wall`);
      return;
    }

    // Check self collision
    if (
      player.snake.some(
        (segment) => segment.x === head.x && segment.y === head.y
      )
    ) {
      player.isAlive = false;
      console.log(`${player.name} hit themselves`);
      return;
    }

    // Check collision with other players
    const room = this.gameRooms.get(player.roomId);
    if (room) {
      for (const otherPlayer of room.players) {
        if (
          otherPlayer.id !== player.id &&
          otherPlayer.isAlive &&
          otherPlayer.snake
        ) {
          if (
            otherPlayer.snake.some(
              (segment) => segment.x === head.x && segment.y === head.y
            )
          ) {
            player.isAlive = false;
            console.log(`${player.name} hit ${otherPlayer.name}'s snake`);
            return;
          }
        }
      }
    }

    player.snake.unshift(head);

    // Check food collision
    if (head.x === player.food.x && head.y === player.food.y) {
      player.score += 10;
      player.food = this.generateFood();
    } else {
      player.snake.pop();
    }
  }

  generateFood() {
    return {
      x: Math.floor(Math.random() * this.gameConfig.tileCount),
      y: Math.floor(Math.random() * this.gameConfig.tileCount),
    };
  }

  endMultiplayerGame(roomId) {
    const room = this.gameRooms.get(roomId);
    if (!room) return;

    if (room.gameLoop) {
      clearInterval(room.gameLoop);
    }

    room.gameStarted = false;

    this.io.to(roomId).emit("multiplayer-game-ended", {
      results: room.players
        .map((p) => ({
          name: p.name,
          score: p.score,
        }))
        .sort((a, b) => b.score - a.score),
    });
  }

  async handleGameOver(socket, data) {
    const player = this.players.get(socket.id);
    if (!player) return;

    const { score } = data;
    player.bestScore = Math.max(player.bestScore, score);
    player.lastGameTime = new Date();
    player.isAlive = false;

    // Save score to database
    try {
      await this.database.saveScore(player.name, score);
    } catch (error) {
      console.error("Error saving score:", error);
    }

    socket.emit("score-saved", { score: score });

    // Update room if multiplayer
    if (player.roomId) {
      const room = this.gameRooms.get(player.roomId);
      if (room) {
        socket.to(player.roomId).emit("player-died", {
          playerId: socket.id,
          playerName: player.name,
          score: score,
        });
      }
    }
  }

  handlePlayerRespawn(socket) {
    const player = this.players.get(socket.id);
    if (!player || !player.roomId) return;

    const room = this.gameRooms.get(player.roomId);
    if (!room || !room.gameStarted) return;

    // Reset player for respawn
    player.score = 0;
    player.isAlive = true;
    player.direction = { x: 0, y: 0 };

    // Find available respawn position
    const alivePlayers = room.players.filter(
      (p) => p.isAlive && p.id !== player.id
    );
    let respawnPosition;
    let attempts = 0;

    do {
      respawnPosition = this.getRandomRespawnPosition();
      attempts++;
    } while (
      attempts < 50 &&
      this.isPositionOccupied(respawnPosition, alivePlayers)
    );

    player.snake = [respawnPosition];
    player.food = this.generateFood();

    // Notify player of successful respawn
    socket.emit("player-respawned", {
      playerId: socket.id,
      snake: player.snake,
      food: player.food,
      score: player.score,
    });

    // Notify other players in room
    socket.to(player.roomId).emit("player-respawned", {
      playerId: socket.id,
      snake: player.snake,
      name: player.name,
    });

    console.log(`Player ${player.name} respawned in room ${player.roomId}`);
  }

  getRandomRespawnPosition() {
    return {
      x: Math.floor(Math.random() * this.gameConfig.tileCount),
      y: Math.floor(Math.random() * this.gameConfig.tileCount),
    };
  }

  isPositionOccupied(position, players) {
    return players.some(
      (player) =>
        player.snake &&
        player.snake.some(
          (segment) => segment.x === position.x && segment.y === position.y
        )
    );
  }

  handlePlayerLeave(socket) {
    console.log(`Player ${socket.id} leaving gracefully`);
    this.handlePlayerDisconnect(socket);
  }

  handlePlayerDisconnect(socket) {
    const player = this.players.get(socket.id);

    if (player && player.roomId) {
      const room = this.gameRooms.get(player.roomId);
      if (room) {
        room.players = room.players.filter((p) => p.id !== socket.id);

        if (room.players.length === 0) {
          if (room.gameLoop) {
            clearInterval(room.gameLoop);
          }
          this.gameRooms.delete(player.roomId);
          console.log(`Room ${player.roomId} deleted - no players left`);
        } else {
          socket.to(player.roomId).emit("player-disconnected", {
            playerId: socket.id,
            playerName: player.name,
          });
        }
      }
    }

    this.players.delete(socket.id);
    this.broadcastPlayerCount();

    console.log(`Player disconnected: ${socket.id}`);
  }

  broadcastPlayerCount() {
    const totalPlayers = this.players.size;
    const multiplayerPlayers = Array.from(this.players.values()).filter(
      (p) => p.gameMode === "multiplayer"
    ).length;

    this.io.emit("player-count-update", {
      total: totalPlayers,
      multiplayer: multiplayerPlayers,
    });
  }

  start(port = 3000) {
    this.database
      .init()
      .then(() => {
        this.server.listen(port, () => {
          console.log(`🐍 Multiplayer Snake Server running on port ${port}`);
          console.log(`🌐 Open http://localhost:${port} to play!`);
        });
      })
      .catch((error) => {
        console.error("Failed to initialize database:", error);
        process.exit(1);
      });
  }
}

// Start server
const server = new MultiplayerSnakeServer();
server.start();

module.exports = MultiplayerSnakeServer;
