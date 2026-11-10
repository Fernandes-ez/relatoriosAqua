@echo off
title Dashboard Next Fit
cd /d "%~dp0"
echo Pasta do projeto: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 goto sem_node

if not exist node_modules (
  echo Instalando dependencias ^(so na primeira vez^)...
  call npm install
  echo.
)

echo Iniciando o servidor em outra janela...
start "Dashboard Next Fit - servidor" cmd /k npm start

echo Aguardando o servidor subir...
timeout /t 4 /nobreak >nul

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE%" (
  echo Abrindo o painel no Edge...
  start "" "%EDGE%" --app=http://localhost:3000
  goto fim
)
if exist "%CHROME%" (
  echo Abrindo o painel no Chrome...
  start "" "%CHROME%" --app=http://localhost:3000
  goto fim
)
echo Edge e Chrome nao encontrados. Abra http://localhost:3000 no navegador.
goto fim

:sem_node
echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e tente de novo.
goto fim

:fim
echo.
echo Pode fechar esta janela. O servidor continua na outra janela.
pause
