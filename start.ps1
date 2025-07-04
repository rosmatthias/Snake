# Multiplayer Snake Game - Quick Start
# Führe dieses Script aus um den Server zu starten: .\start.ps1

Write-Host " Starte Multiplayer Snake Server..."  

# Prüfe ob node_modules existiert
if (-not (Test-Path "node_modules")) {
    Write-Host " Installiere NPM Pakete..." 
    npm install
}

# Server starten
Write-Host " Server startet auf: http://localhost:3000" 
Write-Host " Zum Spielen öffne: http://localhost:3000" 
Write-Host " Auf dem Handy: http://[PC-IP]:3000" 
Write-Host " Drücke Ctrl+C um zu stoppen"

node server.js