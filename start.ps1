$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $Root "backend\python"
$WebDir = Join-Path $Root "frontend\event-finder-frontend"
$Python = Join-Path $ApiDir ".venv\Scripts\python.exe"

function Stop-Tree([System.Diagnostics.Process]$Process) {
    if ($null -eq $Process -or $Process.HasExited) {
        return
    }
    & taskkill.exe /T /F /PID $Process.Id | Out-Null
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker не найден. Запусти Docker Desktop и повтори команду."
}
if (-not (Test-Path $Python)) {
    Write-Error "Нет виртуального окружения. В backend\python выполни: python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt"
}
if (-not (Test-Path (Join-Path $WebDir "node_modules"))) {
    Write-Error "Нет зависимостей фронта. В frontend\event-finder-frontend выполни: npm install"
}

Write-Host "Поднимаю Postgres..."
& docker compose -f (Join-Path $ApiDir "docker-compose.yml") up -d postgres
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$deadline = (Get-Date).AddMinutes(2)
do {
    $status = & docker inspect --format "{{.State.Health.Status}}" event_finder_postgres 2>$null
    if ($status -eq "healthy") {
        break
    }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

if ($status -ne "healthy") {
    Write-Error "Postgres не стал healthy за 2 минуты."
}

$env:DATABASE_URL = "postgresql+psycopg://event_finder_user:event_finder_password@localhost:5432/event_finder_db"
$env:FRONTEND_URL = "http://127.0.0.1:5173/event-finder/#"
$env:CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,https://alexthunder2005.github.io"

$api = $null
$web = $null
try {
    Write-Host "Запускаю API на http://localhost:8080"
    $api = Start-Process -FilePath $Python `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--reload" `
        -WorkingDirectory $ApiDir `
        -PassThru `
        -NoNewWindow

    Write-Host "Запускаю фронт на http://127.0.0.1:5173/event-finder/"
    $npx = (Get-Command npx.cmd).Source
    $web = Start-Process -FilePath $npx `
        -ArgumentList "vite", "--host", "127.0.0.1", "--port", "5173" `
        -WorkingDirectory $WebDir `
        -PassThru `
        -NoNewWindow

    Write-Host ""
    Write-Host "Приложение: http://127.0.0.1:5173/event-finder/"
    Write-Host "Остановка: Ctrl+C"
    Write-Host ""

    while (-not $api.HasExited -and -not $web.HasExited) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "Останавливаю API и фронт..."
    Stop-Tree $api
    Stop-Tree $web
}
