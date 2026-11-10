@echo off
title Dashboard Next Fit
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e tente de novo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias (so na primeira vez)...
  call npm install --omit=dev
)

rem Servidor em uma janela propria (mostra erros, como token ausente).
start "Dashboard Next Fit - servidor" cmd /k "cd /d "%~dp0" && npm start"

rem Espera o servidor subir.
timeout /t 3 /nobreak >nul

rem Abre o painel em janela de app (Edge ou Chrome), sem barra de endereco.
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=http://localhost:3000
) else if exist "%CHROME%" (
  start "" "%CHROME%" --app=http://localhost:3000
) else (
  start "" http://localhost:3000
)
