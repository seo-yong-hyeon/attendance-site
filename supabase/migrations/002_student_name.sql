-- 002: 이름 열은 선택 사항입니다. 기본은 번호만 저장합니다.
alter table students add column if not exists name text;

-- 엑셀 업로드 시 같은 번호를 다시 올리면 덮어쓰도록
-- (class_id, student_no) unique 제약이 1번 마이그레이션에 이미 있습니다.
