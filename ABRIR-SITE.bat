@echo off
rem Abre a loja conceito da MYKONOS no navegador (servidor local na porta 3406).
rem Se o servidor ja estiver no ar, so abre o navegador.
cd /d "%~dp0"
node build.mjs
netstat -ano | findstr /r /c:":3406 .*LISTENING" >nul
if %errorlevel%==0 (
  start "" http://localhost:3406
  exit /b
)
start "" http://localhost:3406
node scripts\serve.mjs 3406
