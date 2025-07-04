# Multiplayer Snake Game 🐍

Ein modernes, multiplayer-fähiges Snake Spiel mit Datenbank-Integration und Echtzeit-Gameplay.

## 🎮 Features

### Multiplayer Features

- **Echtzeit Multiplayer** - Bis zu 4 Spieler gleichzeitig
- **Automatisches Matchmaking** - Spieler werden automatisch in Räume eingeteilt
- **Live Bestenliste** - Globale und Session-basierte Rankings
- **Spieler Status** - Sehe andere Spieler in Echtzeit

### Datenbank Integration

- **SQLite Datenbank** - Alle Scores werden persistent gespeichert
- **Spieler Statistiken** - Tracking von Spielen, besten Scores und Gesamtpunkten
- **Leaderboard System** - Globale Ranglisten mit detaillierten Stats

### Moderne UI/UX

- **Responsive Design** - Funktioniert auf Desktop, Tablet und Smartphone
- **Touch Controls** - Mobile Steuerung mit Buttons
- **Smooth Animations** - Flüssige Übergänge und Effekte
- **Glassmorphism Design** - Moderne UI mit Transparenz-Effekten

## 🚀 Installation & Start

### Schnellstart (Windows PowerShell):

```powershell
# Alles installieren und starten:
.\setup.ps1

# Oder nur starten (wenn bereits installiert):
.\start.ps1
```

### Manueller Start:

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Server starten
npm start
```

## 🌐 Zugriff

- **Desktop:** http://localhost:3000
- **Mobile:** http://[PC-IP]:3000 (PC und Handy im gleichen WLAN)

## 🎯 Spielmodi

### Einzelspieler

- Klassisches Snake Gameplay
- Scores werden in der Datenbank gespeichert
- Progressive Geschwindigkeitserhöhung

### Multiplayer

- 2-4 Spieler pro Raum
- Echtzeit-Synchronisation
- Gemeinsame Bestenliste
- Automatisches Matchmaking

## 🕹️ Steuerung

### Desktop:

- **Pfeiltasten** oder **WASD** für Bewegung
- **Leertaste** zum Starten

### Mobile:

- **Touch-Buttons** für Richtungen
- **Start-Button** zum Spielen

## 📊 Datenbank Schema

### Scores Tabelle:

- Spielername, Score, Timestamp, Spielmodus

### Players Tabelle:

- Name, Gesamtspiele, Bester Score, Gesamtpunkte, Datum

## 🛠️ Technischer Stack

### Backend:

- **Node.js** - Server Runtime
- **Express.js** - Web Framework
- **Socket.IO** - Real-time Communication
- **SQLite3** - Datenbank
- **UUID** - Unique Identifiers

### Frontend:

- **Vanilla JavaScript** - Client Logic
- **HTML5 Canvas** - Game Rendering
- **CSS3** - Modern Styling
- **Socket.IO Client** - Real-time Updates

## 📁 Projektstruktur

```
Snake/
├── server.js           # Main Server
├── database.js         # Database Logic
├── index.html          # Frontend HTML
├── script.js           # Game Client
├── style.css           # Styling
├── package.json        # Dependencies
├── setup.ps1           # Windows Setup Script
├── start.ps1           # Windows Start Script
└── snake_scores.db     # SQLite Database (auto-created)
```

## 🎨 Design Features

- **Gradient Backgrounds** - Beautiful color transitions
- **Glow Effects** - Neon-style game elements
- **Smooth Animations** - CSS3 transitions and keyframes
- **Responsive Layout** - Works on all screen sizes
- **Dark Theme** - Easy on the eyes
- **Modern Typography** - Clean, readable fonts

## 🔧 Entwicklung

### Scripts:

- `npm start` - Startet den Produktionsserver
- `npm run dev` - Startet mit Nodemon (Auto-Reload)

### API Endpoints:

- `GET /api/leaderboard/global` - Globale Bestenliste
- `GET /api/leaderboard/session` - Session Bestenliste
- `POST /api/score` - Score speichern

### WebSocket Events:

- `join-game` - Spiel beitreten
- `start-game` - Spiel starten
- `player-move` - Spielerbewegung
- `game-update` - Spielstand Update
- `game-over` - Spiel beendet

## 📱 Mobile Features

- **Touch-optimiert** - Große, gut erreichbare Buttons
- **Responsive Canvas** - Automatische Größenanpassung
- **Verhindert Scrollen** - Keine störenden Browser-Scrolls
- **Optimierte Performance** - Flüssiges Gameplay auf mobilen Geräten

Viel Spaß beim Spielen! 🐍🎮
