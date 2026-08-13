# 세연중학교 출석부

담임용 조회·종례 출결 + 학생 QR 출결. Next.js + Supabase.

## 1. Supabase SQL 실행

Supabase 대시보드 → SQL Editor 에서 `supabase/migrations` 안의 파일을
번호 순서대로 실행합니다.

```
001_schema.sql
002_student_name.sql
004_student_code_and_qr.sql
```

## 2. Supabase 설정 두 가지

Authentication → Providers → Email

- **Confirm email 끄기** — 학생 계정은 실제 메일 주소가 아니라서
  이게 켜져 있으면 학생 로그인이 전부 막힙니다.

Authentication → URL Configuration

- Site URL 과 Redirect URLs 에 배포 주소를 넣습니다.

## 3. 실행

`setup.bat` 한 번 → 이후로는 `start.bat`.
`.env.local` 은 이미 채워져 있습니다.

## 4. 배포

`git-upload.bat` (처음) / `git-push.bat` (이후).
Vercel 프로젝트 Settings → Environment Variables 에
`.env.local` 의 두 줄을 똑같이 등록해야 합니다.

## 쓰는 순서

1. 선생님 탭으로 가입 후 로그인
2. 학생관리 탭에서 엑셀(학번 열)로 명단 올리기
3. 학생에게 학번 알려주기 — 첫 비밀번호는 0000
4. 출석부 탭 → QR 출결 → 교실 화면에 띄우기
5. 학생이 휴대폰 카메라로 QR 촬영

## 구조

```
app/page.jsx            로그인 후 역할에 따라 화면 분기
app/checkin/page.jsx    QR 을 찍으면 열리는 출석 처리 화면
components/AuthGate     학생(학번) / 선생님(이메일) 로그인
components/AttendanceApp 교사 화면 + QR 모달
components/StudentApp   학생 화면 + 비밀번호 변경
lib/db.js               모든 조회·저장
lib/codes.js            화면 코드 ↔ DB status·reason
```

## 반편성 탭

선생님 화면의 네 번째 탭입니다. 전교생 명단을 엑셀로 올리면
성별과 점수를 고르게 나눠 반을 배정합니다.

- 같은 반이 되면 안 되는 학생을 조로 묶어 제약을 걸 수 있습니다
- 학생을 눌러 두 명을 고르면 서로 자리가 바뀝니다
- 오른쪽 드롭다운으로 다른 반에 바로 옮길 수 있습니다
- 되돌리기, 엑셀 내보내기 지원

이 탭의 자료는 **서버로 보내지 않고 브라우저에만 저장**됩니다.
전교생 이름과 생년월일이 모이는 작업이라 일부러 이렇게 했습니다.
다른 컴퓨터에서는 보이지 않고, 브라우저 자료를 지우면 함께 사라집니다.

## 아직 안 된 것

- 엑셀 내보내기 버튼 (화면만 있고 동작 없음)
- 비밀번호 분실 시 담임이 초기화하는 기능
- 세션 마감
