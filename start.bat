@echo off
title DocumentIQ - Smart Document Q&A & Analyzer
cd /d "%~dp0"
echo =========================================================
echo    Starting DocumentIQ (FastAPI + ChromaDB + Gemini)
echo =========================================================
.\venv\Scripts\python.exe run.py
pause
