@echo off
chcp 65001 >nul
setlocal

set "ROOT=%~dp0"

echo ================================================
echo   TourneyForge - запуск проекта
echo ================================================
echo.

if not exist "%ROOT%backend\node_modules" (
    echo [Backend] Первый запуск: устанавливаю зависимости...
    call npm install --prefix "%ROOT%backend"
    echo.
)

if not exist "%ROOT%backend\.env" (
    echo [Backend] Первый запуск: создаю .env с новым JWT_SECRET...
    pushd "%ROOT%backend"
    node -e "const fs=require('fs');const crypto=require('crypto');const secret=crypto.randomBytes(32).toString('hex');let env=fs.readFileSync('.env.example','utf8');env=env.replace(/JWT_SECRET=\s*$/m,'JWT_SECRET='+secret);fs.writeFileSync('.env',env);console.log('JWT_SECRET сгенерирован.');"
    popd
    echo.
)

if not exist "%ROOT%backend\prisma\dev.db" (
    echo [Backend] Первый запуск: создаю базу данных и демо-команды...
    call npm run db:push --prefix "%ROOT%backend"
    call npm run db:seed --prefix "%ROOT%backend"
    echo.
)

if not exist "%ROOT%frontend\node_modules" (
    echo [Frontend] Первый запуск: устанавливаю зависимости...
    call npm install --prefix "%ROOT%frontend"
    echo.
)

echo Запускаю backend  -^> http://localhost:4000
start "TourneyForge - Backend" cmd /k "cd /d "%ROOT%backend" && npm run start"

timeout /t 2 /nobreak >nul

echo Запускаю frontend -^> http://localhost:5173
start "TourneyForge - Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo ================================================
echo  Готово! Открой в браузере: http://localhost:5173
echo  Чтобы остановить - закрой оба открывшихся окна консоли.
echo ================================================
echo.
pause
