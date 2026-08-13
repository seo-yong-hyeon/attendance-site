@echo off
chcp 65001 >nul
title 출석부 - 깃허브에 올리기
cd /d "%~dp0"

echo ============================================
echo  깃허브에 올리기
echo  폴더: %CD%
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 goto NOGIT
if not exist "package.json" goto NOPKG

rem ── 처음이면 저장소를 만듭니다 ──────────────
if exist ".git" goto HAVEREPO
echo  이 폴더는 아직 깃 저장소가 아닙니다. 새로 만듭니다.
git init
git branch -M main
echo.

:HAVEREPO

rem ── 이름과 이메일이 없으면 물어봅니다 ────────
git config user.name >nul 2>nul
if not errorlevel 1 goto HAVENAME
echo  깃이 처음이라 이름과 이메일이 필요합니다. (아무거나 괜찮습니다)
set /p GNAME=  이름: 
set /p GMAIL=  이메일: 
git config user.name "%GNAME%"
git config user.email "%GMAIL%"
echo.

:HAVENAME

rem ── 원격 주소가 없으면 물어봅니다 ────────────
git remote get-url origin >nul 2>nul
if not errorlevel 1 goto HAVEREMOTE
echo  깃허브 저장소 주소를 붙여넣으세요.
echo  예) https://github.com/아이디/attendance-site.git
echo.
set /p REPO=  주소: 
if "%REPO%"=="" goto NOREPO
git remote add origin %REPO%
echo.

:HAVEREMOTE

rem ── .env.local 이 올라가지 않도록 ────────────
if not exist ".gitignore" (
  > ".gitignore" echo node_modules
  >> ".gitignore" echo .next
  >> ".gitignore" echo .env.local
  >> ".gitignore" echo .env*.local
  >> ".gitignore" echo .vercel
)
findstr /c:".env.local" ".gitignore" >nul 2>nul
if errorlevel 1 >> ".gitignore" echo .env.local

echo ============================================
echo  바뀐 파일
echo ============================================
git status --short
echo.

set MSG=
set /p MSG=  무엇을 바꿨는지 한 줄로 (그냥 Enter 도 됩니다): 
if "%MSG%"=="" set MSG=수정

git add .

rem 키가 딸려 올라가는지 마지막으로 확인
git status --porcelain | findstr /c:".env.local" >nul 2>nul
if not errorlevel 1 goto LEAK

git commit -m "%MSG%"
if errorlevel 1 echo  (새로 바뀐 내용이 없어 커밋은 건너뜁니다)

echo.
echo  올리는 중입니다. 로그인 창이 뜨면 깃허브 계정으로 로그인해 주세요.
echo.

git push -u origin main
if errorlevel 1 goto PUSHFAIL

echo.
echo ============================================
echo  올렸습니다. 1~2분 뒤 Vercel 에 자동 반영됩니다.
echo ============================================
goto END

:NOGIT
echo  [오류] Git 이 설치되어 있지 않습니다.
echo.
echo         https://git-scm.com/download/win 에서 받아 설치하세요.
echo         선택지는 전부 기본값 그대로 두시면 됩니다.
echo         설치 후 이 창을 닫고 다시 실행해 주세요.
goto END

:NOPKG
echo  [오류] package.json 이 없습니다.
echo         이 파일은 프로젝트 폴더 안에 있어야 합니다.
goto END

:NOREPO
echo  [오류] 주소를 입력하지 않으셨습니다.
goto END

:LEAK
echo.
echo  [오류] .env.local 이 업로드 목록에 들어 있습니다. 중단합니다.
echo         .gitignore 를 확인해 주세요.
goto END

:PUSHFAIL
echo.
echo  [오류] 올리지 못했습니다. 아래를 확인해 주세요.
echo.
echo   - 깃허브 로그인을 취소하지 않았는지
echo   - 저장소 주소가 맞는지 (git remote -v 로 확인)
echo   - 저장소에 이미 다른 내용이 있다면 아래를 직접 실행
echo       git pull origin main --allow-unrelated-histories
echo       git push -u origin main
goto END

:END
echo.
pause
