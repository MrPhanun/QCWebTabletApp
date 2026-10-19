@echo off
cd /d "%~dp0"

echo === Pulling latest main ===
git pull origin main
if errorlevel 1 (
  echo Git pull failed.
  pause
  exit /b 1
)

echo.
echo === Installing dependencies ===
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo === Stopping any server already running ===
powershell -NoProfile -Command "if (Test-Path 'run-prod.pid') { try { Stop-Process -Id (Get-Content 'run-prod.pid') -Force -ErrorAction Stop } catch {}; Remove-Item 'run-prod.pid' -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"

if not exist logs mkdir logs

echo.
echo === Starting server in the background (env=production) ===
powershell -NoProfile -Command "$p = Start-Process -FilePath 'node' -ArgumentList 'server.js','--env=production' -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru -RedirectStandardOutput 'logs\prod.out.log' -RedirectStandardError 'logs\prod.err.log'; Set-Content -Path 'run-prod.pid' -Value $p.Id -NoNewline; Write-Host \"Started, PID $($p.Id). Logs: logs\prod.out.log / logs\prod.err.log\""

echo.
echo Server is running in the background. Closing this window will NOT stop it.
echo Run stop-prod.bat to stop it.
pause
