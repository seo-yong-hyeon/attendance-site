@echo off
chcp 65001 >nul
title 출석부 - 폴더 정리
cd /d "%~dp0"

echo ============================================
echo  흩어진 파일을 제자리로 옮깁니다
echo  현재 폴더: %CD%
echo ============================================
echo.

if not exist "app"                  mkdir "app"
if not exist "components"           mkdir "components"
if not exist "lib"                  mkdir "lib"
if not exist "supabase\migrations"  mkdir "supabase\migrations"

call :MOVE layout.jsx            app
call :MOVE page.jsx              app
call :MOVE globals.css           app
call :MOVE AttendanceApp.jsx     components
call :MOVE AuthGate.jsx          components
call :MOVE supabaseClient.js     lib
call :MOVE codes.js              lib
call :MOVE db.js                 lib
call :MOVE 002_student_name.sql  supabase\migrations
call :MOVE attendance_schema.sql supabase\migrations

echo.
echo ---- 확인 ----
call :CHECK package.json
call :CHECK next.config.js
call :CHECK postcss.config.js
call :CHECK tailwind.config.js
call :CHECK app\layout.jsx
call :CHECK app\page.jsx
call :CHECK app\globals.css
call :CHECK components\AttendanceApp.jsx
call :CHECK components\AuthGate.jsx
call :CHECK lib\supabaseClient.js
call :CHECK lib\codes.js
call :CHECK lib\db.js
call :CHECK .env.local

echo.
echo 위 목록에 [없음] 이 하나도 없으면 start.bat 을 실행하세요.
echo.
pause
exit /b

:MOVE
if exist "%~1" (
  move /y "%~1" "%~2\" >nul
  echo  옮김: %~1 -^> %~2\
)
exit /b

:CHECK
if exist "%~1" (
  echo  [있음] %~1
) else (
  echo  [없음] %~1
)
exit /b
