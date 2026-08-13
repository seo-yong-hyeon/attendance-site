@echo off
chcp 65001 >nul
title 출석부 - GitHub 첫 업로드
cd /d "%~dp0"

echo ============================================
echo  GitHub 저장소로 첫 업로드
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [오류] Git 이 설치되어 있지 않습니다.
  echo.
  echo        https://git-scm.com/download/win 에서 받아 설치하세요.
  echo        설치 중 선택지는 전부 기본값 그대로 두시면 됩니다.
  echo        설치가 끝나면 이 창을 닫고 다시 실행해 주세요.
  echo.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [오류] package.json 이 없습니다. 프로젝트 폴더에서 실행해 주세요.
  echo        현재 폴더: %CD%
  pause
  exit /b 1
)

if not exist ".gitignore" (
  > ".gitignore" echo node_modules
  >> ".gitignore" echo .next
  >> ".gitignore" echo .env.local
  >> ".gitignore" echo .env*.local
  >> ".gitignore" echo .vercel
  echo  .gitignore 를 새로 만들었습니다.
) else (
  findstr /c:".env.local" ".gitignore" >nul 2>nul
  if errorlevel 1 (
    >> ".gitignore" echo .env.local
    >> ".gitignore" echo .env*.local
    >> ".gitignore" echo .vercel
    echo  .gitignore 에 제외 규칙을 추가했습니다.
  )
)

echo  Git 확인 완료. .env.local 은 업로드에서 제외됩니다.
echo.
echo  GitHub 에서 만든 저장소 주소를 붙여넣으세요.
echo  (저장소는 반드시 Private 으로 만드세요)
echo.
echo  예) https://github.com/아이디/attendance-site.git
echo.
set /p REPO=  주소: 

if "%REPO%"=="" (
  echo.
  echo [오류] 주소가 비어 있습니다.
  pause
  exit /b 1
)

echo.
if not exist ".git" (
  git init
  git branch -M main
)

call :ENSURE_ID

git add .

git status --porcelain | findstr /c:".env.local" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo [오류] .env.local 이 업로드 목록에 들어 있습니다.
  echo        중단합니다. .gitignore 를 확인해 주세요.
  pause
  exit /b 1
)

git commit -m "출결 사이트 첫 배포"
git remote remove origin >nul 2>nul
git remote add origin %REPO%

echo.
echo  올리는 중입니다. GitHub 로그인 창이 뜨면 로그인해 주세요.
echo.
git push -u origin main

if errorlevel 1 (
  echo.
  echo [오류] 업로드에 실패했습니다.
  echo.
  echo        위 메시지에 rejected 또는 fetch first 가 보이면
  echo        저장소를 만들 때 README 를 같이 만든 경우입니다.
  echo        아래 명령을 한 번 실행한 뒤 이 파일을 다시 실행하세요.
  echo.
  echo          git pull --rebase origin main
  echo.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  업로드 완료. 이제 vercel.com 에서
echo  Add New - Project 로 이 저장소를 Import 하세요.
echo ============================================
pause

exit /b

:ENSURE_ID
git config user.name >nul 2>nul
if not errorlevel 1 goto CHECK_MAIL
echo.
echo  Git 을 처음 쓰시는군요. 커밋 기록에 남길 정보가 필요합니다.
set /p GNAME=  이름 (예: seo-yong-hyeon): 
git config user.name "%GNAME%"
:CHECK_MAIL
git config user.email >nul 2>nul
if not errorlevel 1 exit /b
set /p GMAIL=  GitHub 가입 이메일: 
git config user.email "%GMAIL%"
exit /b
