@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 세연중학교 출석부 (이 창을 닫으면 꺼집니다)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 가 없습니다. setup.bat 을 먼저 실행해 주세요.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
for /f "tokens=1 delims=." %%a in ("!NODEVER!") do set NODEMAJOR=%%a
set NODEMAJOR=!NODEMAJOR:v=!
if !NODEMAJOR! LSS 20 (
  echo [오류] Node.js 20 이상이 필요합니다. 현재 버전: !NODEVER!
  echo     https://nodejs.org 에서 LTS 버전을 설치해 주세요.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [오류] package.json 이 없습니다.
  echo        이 배치 파일은 프로젝트 폴더 안에 있어야 합니다.
  echo        현재 폴더: %CD%
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [오류] 패키지가 설치되어 있지 않습니다.
  echo     setup.bat 을 먼저 실행해 주세요.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo [오류] .env.local 이 없습니다.
  echo     setup.bat 을 먼저 실행해 주세요.
  pause
  exit /b 1
)

echo ============================================
echo  출석부를 켭니다.
echo  준비가 끝나면 브라우저가 자동으로 열립니다.
echo  처음 실행은 30초에서 1분쯤 걸립니다. 기다려 주세요.
echo.
echo  주소: http://localhost:3000
echo  끄려면 이 창을 닫거나 Ctrl+C 를 누르세요.
echo ============================================
echo.

rem 서버가 실제로 열릴 때까지 확인하다가 브라우저를 엽니다 (최대 3분)
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$n=0; while($n -lt 90){ try{ $c=New-Object Net.Sockets.TcpClient('127.0.0.1',3000); $c.Close(); Start-Process 'http://localhost:3000'; break }catch{ Start-Sleep -Seconds 2; $n++ } }"

call npm run dev

echo.
echo 서버가 종료되었습니다.
pause
