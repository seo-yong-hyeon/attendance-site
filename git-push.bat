@echo off
chcp 65001 >nul
title 출석부 - 수정사항 올리기
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo [오류] Git 이 없습니다.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [오류] 아직 GitHub 에 연결되지 않았습니다.
  echo        git-upload.bat 을 먼저 실행해 주세요.
  pause
  exit /b 1
)

echo ============================================
echo  바뀐 파일
echo ============================================
git status --short
echo.

set /p MSG=  무엇을 바꿨는지 한 줄로: 
if "%MSG%"=="" set MSG=수정

git add .
git commit -m "%MSG%"
git push

if errorlevel 1 (
  echo.
  echo [오류] 올리지 못했습니다.
  pause
  exit /b 1
)

echo.
echo  올렸습니다. 1~2분 뒤 Vercel 에 자동 반영됩니다.
pause
