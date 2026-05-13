@echo off
chcp 65001 > nul
title Yatirim Analiz Platformu
color 0b
cd /d "%~dp0"

echo ======================================================
echo          YATIRIM ANALIZ VE GUVENLIK MOTORU
echo ======================================================
echo.

echo [INFO] Kutuphaneler kontrol ediliyor...
pip install -U google-genai groq fastapi uvicorn python-multipart httpx slowapi pydantic yfinance --quiet

:: API Key Ayarlari - Kendi anahtarlarinizi girin
set GOOGLE_API_KEY=BURAYA_GOOGLE_API_KEY_GIRIN
set GROQ_API_KEY=BURAYA_GROQ_API_KEY_GIRIN

echo [OK] API Anahtarlari yuklendi.
echo [!] Sunucu baslatiliyor... 8000 portu dinleniyor.
echo ------------------------------------------------------

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause
