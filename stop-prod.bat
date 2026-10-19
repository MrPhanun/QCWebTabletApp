@echo off
cd /d "%~dp0"

echo === Stopping server ===
powershell -NoProfile -Command "$stopped = $false; if (Test-Path 'run-prod.pid') { try { Stop-Process -Id (Get-Content 'run-prod.pid') -Force -ErrorAction Stop; $stopped = $true } catch {}; Remove-Item 'run-prod.pid' -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $stopped = $true }; if ($stopped) { Write-Host 'Server stopped.' } else { Write-Host 'No running server found.' }"

pause
