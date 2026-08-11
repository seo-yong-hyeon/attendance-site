@echo off
chcp 65001 >nul
title 출석부 - 파일 점검
cd /d "%~dp0"

echo ============================================
echo  실제 파일 이름을 그대로 보여줍니다
echo  %CD%
echo ============================================
echo.
echo [루트]
dir /b /a-d 2>nul
echo.
echo [app]
dir /b app 2>nul || echo  (app 폴더 없음)
echo.
echo [components]
dir /b components 2>nul || echo  (components 폴더 없음)
echo.
echo [lib]
dir /b lib 2>nul || echo  (lib 폴더 없음)
echo.
echo ============================================
echo  app 안에 layout.jsx / page.jsx / globals.css
echo  이 세 개가 정확히 이 이름으로 있어야 합니다.
echo  뒤에 .txt 가 붙어 있으면 이름을 고쳐주세요.
echo ============================================
pause
