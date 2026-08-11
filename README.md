# 세연중학교 출석부

담임용 조회·종례 출결 기록. Next.js + Supabase.

## 1. 폴더 준비

이 폴더 전체를 컴퓨터 원하는 곳에 두면 됩니다. `create-next-app` 을 따로 돌릴
필요는 없습니다. 필요한 설정 파일이 모두 들어 있습니다.

필요한 것은 **Node.js 20 이상** 하나뿐입니다. https://nodejs.org 에서 LTS 를
받아 설치하세요. 이미 낮은 버전이 깔려 있으면 그 위에 덮어 설치하면 됩니다.

폴더 안에 아래 파일들이 다 있어야 합니다.

```
package.json      setup.bat        start.bat
next.config.js    postcss.config.js  tailwind.config.js
app/  components/  lib/  supabase/
```

## 2. Supabase 준비

1. supabase.com 에서 프로젝트 생성 (리전은 Northeast Asia / Seoul)
2. SQL Editor 에 `attendance_schema.sql` 실행
3. 이어서 `supabase/migrations/002_student_name.sql` 실행
4. Authentication → Providers → Email 켜기
   - 혼자 쓸 거면 Confirm email 을 꺼두면 가입 즉시 로그인됩니다

## 3. 환경변수

`.env.local.example` 을 `.env.local` 로 복사하고 값을 채웁니다.
값은 Supabase 대시보드 → Project Settings → API 에 있습니다.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`service_role` 키는 절대 여기 넣지 마세요. 브라우저에 그대로 노출됩니다.

## 4. 실행 (Windows)

`setup.bat` 을 한 번 실행해 설치하고, 다음부터는 `start.bat` 만 두 번 클릭하면 됩니다.

### 직접 명령으로 실행하려면

```bash
npm run dev
```

http://localhost:3000 에서 가입 → 로그인 → 학생관리 탭에서 엑셀 올리기 → 출석부.

## 5. 배포

GitHub 저장소에 올리고 Vercel 에서 Import.
Vercel 프로젝트 Settings → Environment Variables 에 위 두 값을 똑같이 등록해야
배포본에서 동작합니다.

## 구조

```
app/page.jsx              로그인 확인 후 출석부 표시
components/AuthGate.jsx   이메일 로그인·가입
components/AttendanceApp  출석부 / 학생관리 / 지각·결석 조회
lib/supabaseClient.js     Supabase 연결
lib/codes.js              화면 코드 ↔ DB status·reason 변환
lib/db.js                 모든 조회·저장 함수
```

## 아직 안 된 것

- 엑셀 내보내기 버튼 (화면만 있고 동작 없음)
- QR 출결
- 세션 마감 (`closeSession` 함수는 있으나 화면 미연결)
