@echo off
title AymnEDU - Lancement de l'application
color 0A

echo ========================================================
echo         Lancement de AymnEDU (Backend + Frontend)
echo ========================================================
echo.

:: 1. Demarrage du Backend FastAPI dans une nouvelle fenetre
echo [1/2] Lancement du Backend sur http://127.0.0.1:8080 ...
start "AymnEDU - Backend (FastAPI)" cmd /k "cd /d %~dp0aymnedu\backend && .venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload"

:: Pause de 2 secondes pour laisser le backend initialiser
timeout /t 2 /nobreak >nul

:: 2. Demarrage du Frontend Vite dans une nouvelle fenetre
echo [2/2] Lancement du Frontend sur http://localhost:5173 ...
start "AymnEDU - Frontend (React/Vite)" cmd /k "cd /d %~dp0aymnedu\frontend && npm run dev"

echo.
echo ========================================================
echo   Application demarree avec succes !
echo   - Frontend : http://localhost:5173
echo   - Backend  : http://127.0.0.1:8080/docs
echo ========================================================
echo.
echo Ouverture du navigateur...
timeout /t 2 /nobreak >nul
start http://localhost:5173

exit

