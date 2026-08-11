@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 출석부 - 처음 설치
cd /d "%~dp0"

echo ============================================
echo  세연중학교 출석부 - 처음 설치
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  echo.
  echo     https://nodejs.org 에서 LTS 버전을 받아 설치한 뒤
  echo     이 파일을 다시 실행해 주세요.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set NODEVER=%%v
for /f "tokens=1 delims=." %%a in ("!NODEVER!") do set NODEMAJOR=%%a
set NODEMAJOR=!NODEMAJOR:v=!

if !NODEMAJOR! LSS 20 (
  echo [오류] Node.js 버전이 낮습니다. 현재 버전: !NODEVER!
  echo.
  echo     Next.js 를 돌리려면 20 이상이 필요합니다.
  echo     https://nodejs.org 에서 LTS 버전을 받아 덮어 설치한 뒤
  echo     이 창을 닫고 다시 실행해 주세요.
  echo.
  echo     설치했는데도 같은 메시지가 나오면 컴퓨터를 한 번 껐다 켜세요.
  echo.
  pause
  exit /b 1
)

echo  Node.js !NODEVER! 확인
echo.

if not exist "package.json" (
  echo [오류] package.json 이 없습니다.
  echo        이 배치 파일은 프로젝트 폴더 안에 있어야 합니다.
  echo        현재 폴더: %CD%
  pause
  exit /b 1
)

if exist ".env.local" (
  echo [1/2] .env.local 이 이미 있습니다. 건너뜁니다.
) else (
  > ".env.local" echo NEXT_PUBLIC_SUPABASE_URL=
  >> ".env.local" echo NEXT_PUBLIC_SUPABASE_ANON_KEY=
  echo [1/2] .env.local 파일을 만들었습니다.
  echo.
  echo       메모장이 열리면 두 줄의 = 뒤에 값을 붙여넣고
  echo       저장한 뒤 메모장을 닫아주세요.
  echo.
  echo       값 위치: Supabase 대시보드 - Project Settings - API
  echo         Project URL     : 첫째 줄
  echo         anon public 키  : 둘째 줄
  echo.
  pause
  notepad ".env.local"
)

echo.
echo [2/2] 필요한 패키지를 내려받습니다. 처음에는 몇 분 걸립니다.
echo.
call npm install
if errorlevel 1 (
  echo.
  echo [오류] 설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행해 주세요.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  설치 완료. 이제 start.bat 을 실행하세요.
echo ============================================
pause
