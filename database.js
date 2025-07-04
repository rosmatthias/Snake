const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, "snake_scores.db");
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error("Error opening database:", err);
          reject(err);
        } else {
          console.log("📊 Database connected successfully");
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createScoresTable = `
                CREATE TABLE IF NOT EXISTS scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_name TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    game_mode TEXT DEFAULT 'singleplayer'
                )
            `;

      const createPlayersTable = `
                CREATE TABLE IF NOT EXISTS players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    total_games INTEGER DEFAULT 0,
                    best_score INTEGER DEFAULT 0,
                    total_score INTEGER DEFAULT 0,
                    first_played DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_played DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

      const createIndexes = `
                CREATE INDEX IF NOT EXISTS idx_scores_player_name ON scores(player_name);
                CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
                CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON scores(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_players_best_score ON players(best_score DESC);
            `;

      this.db.exec(createScoresTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.exec(createPlayersTable, (err) => {
          if (err) {
            reject(err);
            return;
          }

          this.db.exec(createIndexes, (err) => {
            if (err) {
              reject(err);
            } else {
              console.log("📋 Database tables created/verified");
              resolve();
            }
          });
        });
      });
    });
  }

  async saveScore(playerName, score, gameMode = "singleplayer") {
    return new Promise((resolve, reject) => {
      // Insert score record
      const insertScore = `
                INSERT INTO scores (player_name, score, game_mode) 
                VALUES (?, ?, ?)
            `;

      this.db.run(insertScore, [playerName, score, gameMode], function (err) {
        if (err) {
          reject(err);
          return;
        }

        // Update or insert player record
        const updatePlayer = `
                    INSERT INTO players (name, total_games, best_score, total_score, last_played)
                    VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(name) DO UPDATE SET
                        total_games = total_games + 1,
                        best_score = MAX(best_score, ?),
                        total_score = total_score + ?,
                        last_played = CURRENT_TIMESTAMP
                `;

        this.db.run(
          updatePlayer,
          [playerName, score, score, score, score],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({ scoreId: this.lastID });
            }
          }
        );
      });
    });
  }

  async getGlobalLeaderboard(limit = 10) {
    return new Promise((resolve, reject) => {
      const query = `
                SELECT 
                    p.name,
                    p.best_score as score,
                    p.total_games,
                    p.total_score,
                    p.last_played,
                    (SELECT COUNT(*) + 1 FROM players p2 WHERE p2.best_score > p.best_score) as rank
                FROM players p
                WHERE p.best_score > 0
                ORDER BY p.best_score DESC, p.last_played ASC
                LIMIT ?
            `;

      this.db.all(query, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            rows.map((row, index) => ({
              rank: index + 1,
              name: row.name,
              score: row.score,
              totalGames: row.total_games,
              totalScore: row.total_score,
              lastPlayed: row.last_played,
            }))
          );
        }
      });
    });
  }

  async getRecentScores(limit = 20) {
    return new Promise((resolve, reject) => {
      const query = `
                SELECT player_name, score, timestamp, game_mode
                FROM scores
                ORDER BY timestamp DESC
                LIMIT ?
            `;

      this.db.all(query, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getPlayerStats(playerName) {
    return new Promise((resolve, reject) => {
      const query = `
                SELECT 
                    p.*,
                    (SELECT COUNT(*) FROM scores s WHERE s.player_name = p.name) as total_games_detailed,
                    (SELECT AVG(score) FROM scores s WHERE s.player_name = p.name) as average_score
                FROM players p
                WHERE p.name = ?
            `;

      this.db.get(query, [playerName], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getTopScoresThisWeek(limit = 10) {
    return new Promise((resolve, reject) => {
      const query = `
                SELECT player_name, MAX(score) as best_score, COUNT(*) as games_played
                FROM scores
                WHERE timestamp >= datetime('now', '-7 days')
                GROUP BY player_name
                ORDER BY best_score DESC, games_played DESC
                LIMIT ?
            `;

      this.db.all(query, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log("📊 Database connection closed");
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;
