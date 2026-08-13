@echo off
chcp 65001 >nul
title 출석부 - 처음 설치
cd /d "%~dp0"

echo ============================================
echo  세연중학교 출석부 - 처음 설치
echo  폴더: %CD%
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto NONODE

set NODEMAJOR=
for /f "tokens=1 delims=." %%a in ('node -v') do set NODEMAJOR=%%a
if not defined NODEMAJOR goto BADVER
set NODEMAJOR=%NODEMAJOR:v=%
if %NODEMAJOR% LSS 20 goto BADVER

echo  Node.js v%NODEMAJOR% 확인
echo.

if not exist "package.json" goto NOPKG
if exist ".env.local" goto INSTALL

echo  .env.local 이 없어서 새로 만듭니다.
> ".env.local" echo NEXT_PUBLIC_SUPABASE_URL=
>> ".env.local" echo NEXT_PUBLIC_SUPABASE_ANON_KEY=
echo  메모장이 열리면 = 뒤에 Supabase 값을 넣고 저장한 뒤 닫아주세요.
echo.
pause
notepad ".env.local"

:INSTALL
echo.
echo  필요한 패키지를 내려받습니다. 처음에는 몇 분 걸립니다.
echo.
call npm install
if errorlevel 1 goto FAIL

echo.
echo ============================================
echo  설치 완료. 이제 start.bat 을 실행하세요.
echo ============================================
goto END

:NONODE
echo  [오류] Node.js 가 설치되어 있지 않습니다.
echo.
echo         https://nodejs.org 에서 LTS 버전을 받아 설치한 뒤
echo         이 창을 닫고 다시 실행해 주세요.
goto END

:BADVER
echo  [오류] Node.js 20 이상이 필요합니다.
node -v
echo.
echo         https://nodejs.org 에서 LTS 버전을 덮어 설치한 뒤
echo         이 창을 닫고 다시 실행해 주세요.
goto END

:NOPKG
echo  [오류] package.json 이 없습니다.
echo         이 파일은 프로젝트 폴더 안에 있어야 합니다.
goto END

:FAIL
echo.
echo  [오류] 패키지 설치에 실패했습니다.
echo         인터넷 연결을 확인하고 다시 실행해 주세요.
goto END

:END
echo.
pause
