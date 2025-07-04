# Multiplayer Snake Game - Setup und Start Script
# Führe dieses Script in PowerShell aus: .\setup.ps1

Write-Host "🐍 Multiplayer Snake Game Setup" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Node.js installieren prüfen
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js ist installiert: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js ist nicht installiert!" -ForegroundColor Red
    Write-Host "Bitte installieren Sie Node.js von: https://nodejs.org" -ForegroundColor Yellow
    exit
}

# NPM Pakete installieren
Write-Host "📦 Installiere NPM Pakete..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ NPM Pakete erfolgreich installiert!" -ForegroundColor Green
} else {
    Write-Host "❌ Fehler beim Installieren der NPM Pakete!" -ForegroundColor Red
    exit
}

# Server starten
Write-Host ""
Write-Host "🚀 Starte Multiplayer Snake Server..." -ForegroundColor Green
Write-Host "Server läuft auf: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Drücke Ctrl+C um den Server zu stoppen" -ForegroundColor Yellow
Write-Host ""

npm start
