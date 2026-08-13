@echo off
chcp 65001 >nul
title 세연중학교 출석부 (이 창을 닫으면 꺼집니다)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto NONODE
if not exist "package.json" goto NOPKG
if not exist "node_modules" goto NOMODULES
if not exist ".env.local" goto NOENV

echo ============================================
echo  출석부를 켭니다.
echo  준비가 끝나면 브라우저가 자동으로 열립니다.
echo  처음 실행은 30초에서 1분쯤 걸립니다.
echo.
echo  주소: http://localhost:3000
echo  끄려면 이 창을 닫거나 Ctrl+C 를 누르세요.
echo.
echo  주의: 창 안을 클릭해 드래그하면 서버가 멈춥니다.
echo        그럴 때는 Esc 를 누르세요.
echo ============================================
echo.

start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$n=0; while($n -lt 90){ try{ $c=New-Object Net.Sockets.TcpClient('127.0.0.1',3000); $c.Close(); Start-Process 'http://localhost:3000'; break }catch{ Start-Sleep -Seconds 2; $n++ } }"

call npm run dev
echo.
echo  서버가 종료되었습니다.
goto END

:NONODE
echo  [오류] Node.js 가 없습니다. setup.bat 을 먼저 실행해 주세요.
goto END

:NOPKG
echo  [오류] package.json 이 없습니다.
echo         현재 폴더: %CD%
goto END

:NOMODULES
echo  [오류] 패키지가 설치되어 있지 않습니다.
echo         setup.bat 을 먼저 실행해 주세요.
goto END

:NOENV
echo  [오류] .env.local 이 없습니다.
echo         setup.bat 을 먼저 실행해 주세요.
goto END

:END
echo.
pause
