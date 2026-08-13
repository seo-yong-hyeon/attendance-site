// 반편성 데이터 모델 + 엑셀/PDF 파싱 + 매칭 로직.
// 원본 https://jingiru.github.io/nuclass2/ (반올림) app.js 를 그대로 포팅.
// 순수 함수만 둔다 — DOM/React 상태는 여기서 건드리지 않는다.

/* ── localStorage 키 ─────────────────────────────── */

export const GRADES_KEY = "placement_grades";

export function dataKey(grade) {
  return `placement_data_${grade}`;
}
export function redFlagKey(grade) {
  return `placement_redflag_${grade}`;
}
export function teamKey(grade) {
  return `placement_teams_${grade}`;
}
export function viewOptsKey(grade) {
  return `placement_viewopts_${grade}`;
}

/* ── 반 키 유틸 ───────────────────────────────────── */

export function parseClassKey(classKey) {
  const [grade, classNum] = classKey.split("-");
  return { grade, classNum };
}

export function getValidClasses(classData) {
  return Object.keys(classData).filter(
    (cls) => cls !== "history" && cls !== "undefined"
  );
}

export function sortClasses(classes) {
  return [...classes].sort((a, b) => {
    const pa = parseClassKey(a);
    const pb = parseClassKey(b);
    const ga = Number(pa.grade);
    const gb = Number(pb.grade);
    const ca = Number(pa.classNum);
    const cb = Number(pb.classNum);
    if (ga !== gb) return ga - gb;
    return ca - cb;
  });
}

export function getSortedValidClasses(classData) {
  return sortClasses(getValidClasses(classData));
}

/* ── 이름/번호/생년월일 정규화 ───────────────────── */

export function normName(name) {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normNum(v) {
  const n = String(v ?? "").replace(/[^\d]/g, "");
  return n === "" ? "" : String(Number(n));
}

export function normBirth(v) {
  const digits = String(v ?? "").replace(/[^\d]/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : digits;
}

export function makePrevKey(prevGrade, prevClass, prevNo) {
  const g = normNum(prevGrade);
  const c = normNum(prevClass);
  const n = normNum(prevNo);
  if (g && c && n) return `${g}-${c}-${n}`;
  return null;
}

/* ── PDF 텍스트 파싱 (NEIS 반편성결과 PDF) ──────── */

const NORMAL_PATTERN =
  /(\d+)\s*(?:학년)?\s+(\d+)\s+(\d+)\s+([^\d]+?)\s+(\d{4}\.\d{2}\.\d{2})\.?\s+(남|여)\s+([\d.]+)\s+(\d+)\s*(?:학년)?\s+(\d+)\s+(\d+)/g;

const TRANSFER_IN_PATTERN =
  /(\d+)\s*(?:학년)?\s+(\d+)\s+(\d+)\s+([^\d]+?)\s+(\d{4}\.\d{2}\.\d{2})\.?\s+(남|여)\s+([\d.]+)\s+전입/g;

export function parsePdfText(text) {
  const classes = {};

  let match;
  NORMAL_PATTERN.lastIndex = 0;
  while ((match = NORMAL_PATTERN.exec(text)) !== null) {
    const [
      ,
      grade,
      classNum,
      number,
      name,
      birthDate,
      gender,
      score,
      prevGrade,
      prevClass,
      prevNumber,
    ] = match;

    const classKey = `${grade}-${classNum}`;
    (classes[classKey] ??= []).push({
      번호: number,
      성명: normName(name),
      생년월일: birthDate,
      성별: gender,
      기준성적: score,
      이전학적: `${prevGrade} ${prevClass} ${prevNumber}`,
      이전학적학년: prevGrade,
      이전학적반: prevClass,
      이전학적번호: prevNumber,
      특이사항: "",
    });
  }

  TRANSFER_IN_PATTERN.lastIndex = 0;
  while ((match = TRANSFER_IN_PATTERN.exec(text)) !== null) {
    const [, grade, classNum, number, name, birthDate, gender, score] = match;

    const classKey = `${grade}-${classNum}`;
    (classes[classKey] ??= []).push({
      번호: number,
      성명: normName(name),
      생년월일: birthDate,
      성별: gender,
      기준성적: score,
      이전학적: "전입",
      이전학적학년: String(parseInt(grade, 10) - 1),
      이전학적반: "",
      이전학적번호: "",
      특이사항: "",
    });
  }

  Object.keys(classes).forEach((cls) => {
    classes[cls].sort((a, b) => Number(a.번호) - Number(b.번호));
  });

  return classes;
}

/* ── 엑셀 원장 매칭 (학번 백필) ──────────────────── */

export function buildExcelPrevMap(excelRoster) {
  const excelPrevKeyToUniqueId = new Map();
  const excelNameBirthToUniqueId = new Map();
  const excelNameToUniqueId = new Map();

  if (!Array.isArray(excelRoster)) {
    return { excelPrevKeyToUniqueId, excelNameBirthToUniqueId, excelNameToUniqueId };
  }

  excelRoster.forEach((row) => {
    const uniqueId = row["학번"];
    if (!uniqueId) return;

    const prevG = normNum(row["이전학년"]);
    const prevC = normNum(row["이전반"]);
    const prevN = normNum(row["이전번호"]);
    if (prevG && prevC && prevN) {
      excelPrevKeyToUniqueId.set(`${prevG}-${prevC}-${prevN}`, String(uniqueId).trim());
    }

    const name = String(row["성명"] ?? "").trim();
    const birth = normBirth(row["생년월일"]);
    if (name && birth) {
      excelNameBirthToUniqueId.set(`${name}|${birth}`, String(uniqueId).trim());
    }

    if (name) {
      if (!excelNameToUniqueId.has(name)) {
        excelNameToUniqueId.set(name, String(uniqueId).trim());
      } else {
        const existing = excelNameToUniqueId.get(name);
        if (Array.isArray(existing)) existing.push(String(uniqueId).trim());
        else excelNameToUniqueId.set(name, [existing, String(uniqueId).trim()]);
      }
    }
  });

  return { excelPrevKeyToUniqueId, excelNameBirthToUniqueId, excelNameToUniqueId };
}

// classData를 직접 변형하지 않고, 학번이 채워진 새 classData를 반환한다.
export function attachUniqueIdsToClassData(classData, maps) {
  const { excelPrevKeyToUniqueId, excelNameBirthToUniqueId, excelNameToUniqueId } = maps;
  const next = {};

  Object.keys(classData).forEach((cls) => {
    if (cls === "history" || cls === "undefined") {
      next[cls] = classData[cls];
      return;
    }

    next[cls] = (classData[cls] || []).map((student) => {
      if (student.고유학번) return student;

      let uniqueId = null;

      if (student.이전학적 === "전입") {
        const name = String(student.성명 ?? "").trim();
        const birth = normBirth(student.생년월일);

        if (name && birth) {
          uniqueId = excelNameBirthToUniqueId.get(`${name}|${birth}`) || null;
        }
        if (!uniqueId && name) {
          const nameMatch = excelNameToUniqueId.get(name);
          if (nameMatch && !Array.isArray(nameMatch)) uniqueId = nameMatch;
        }
      } else {
        const prevKey = makePrevKey(
          student.이전학적학년,
          student.이전학적반,
          student.이전학적번호
        );
        if (prevKey) uniqueId = excelPrevKeyToUniqueId.get(prevKey) || null;

        if (!uniqueId) {
          const name = String(student.성명 ?? "").trim();
          const birth = normBirth(student.생년월일);
          if (name && birth) {
            uniqueId = excelNameBirthToUniqueId.get(`${name}|${birth}`) || null;
          }
        }
      }

      return uniqueId ? { ...student, 고유학번: uniqueId } : student;
    });
  });

  return next;
}

/* ── 상태 깊은 복제 (되돌리기 스냅샷용) ─────────── */

export function cloneBoardState(board) {
  return {
    classData: JSON.parse(JSON.stringify(board.classData)),
    history: [...board.history],
    changedStudents: new Set(board.changedStudents),
    movedStudents: new Set(board.movedStudents),
  };
}

/* ── 기본 보기 옵션 ───────────────────────────────── */

export const DEFAULT_VIEW_OPTIONS = {
  gridColumns: 2,
  showStats: true,
  showBirthdate: true,
  showGender: true,
  showSpecial: false,
  fontScale: 1,
};

/* ── localStorage 저장/불러오기 ──────────────────── */

export function loadBoardFromStorage(grade) {
  try {
    const saved = localStorage.getItem(dataKey(grade));
    if (!saved) return { classData: {}, history: [], changedStudents: new Set(), movedStudents: new Set() };
    const parsed = JSON.parse(saved);
    return {
      classData: parsed.classData || {},
      history: parsed.history || [],
      changedStudents: new Set(parsed.changedStudents || []),
      movedStudents: new Set(parsed.movedStudents || []),
    };
  } catch {
    return { classData: {}, history: [], changedStudents: new Set(), movedStudents: new Set() };
  }
}

export function saveBoardToStorage(grade, board) {
  try {
    localStorage.setItem(
      dataKey(grade),
      JSON.stringify({
        classData: board.classData,
        history: board.history,
        changedStudents: Array.from(board.changedStudents),
        movedStudents: Array.from(board.movedStudents),
      })
    );
  } catch {
    /* 저장 공간이 없으면 그냥 넘어간다 */
  }
}

export function loadViewOptions(grade) {
  try {
    const saved = localStorage.getItem(viewOptsKey(grade));
    if (!saved) return { ...DEFAULT_VIEW_OPTIONS };
    const parsed = JSON.parse(saved);
    return {
      fontScale: Number(parsed.fontScale) || 1,
      gridColumns: Number(parsed.gridColumns) || 2,
      showStats: parsed.showStats !== false,
      showBirthdate: parsed.showBirthdate !== false,
      showGender: parsed.showGender !== false,
      showSpecial: parsed.showSpecial === true,
    };
  } catch {
    return { ...DEFAULT_VIEW_OPTIONS };
  }
}

export function saveViewOptions(grade, viewOptions) {
  try {
    localStorage.setItem(viewOptsKey(grade), JSON.stringify(viewOptions));
  } catch {
    /* noop */
  }
}

export function loadRecentGrades() {
  try {
    return JSON.parse(localStorage.getItem(GRADES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveRecentGrade(grade) {
  try {
    let grades = loadRecentGrades().filter((g) => g !== grade);
    grades.unshift(grade);
    grades = grades.slice(0, 10);
    localStorage.setItem(GRADES_KEY, JSON.stringify(grades));
  } catch {
    /* noop */
  }
}

/* ── 분리조건(그룹/팀) 저장·불러오기 ─────────────── */

export function loadSeparationGroups(grade) {
  try {
    return JSON.parse(localStorage.getItem(redFlagKey(grade)) || "[]");
  } catch {
    return [];
  }
}
export function saveSeparationGroups(grade, groups) {
  try {
    localStorage.setItem(redFlagKey(grade), JSON.stringify(groups));
  } catch {
    /* noop */
  }
}
export function loadSeparationTeams(grade) {
  try {
    return JSON.parse(localStorage.getItem(teamKey(grade)) || "[]");
  } catch {
    return [];
  }
}
export function saveSeparationTeams(grade, teams) {
  try {
    localStorage.setItem(teamKey(grade), JSON.stringify(teams));
  } catch {
    /* noop */
  }
}

/* ── 학생 이름 검색 / 동명이인 처리 ───────────────── */

// 입력한 이름과 정확히 일치하는 학생 후보 전체를 반환한다(동명이인 판별용).
export function findStudentCandidates(classData, inputName) {
  const candidates = [];
  getValidClasses(classData).forEach((cls) => {
    (classData[cls] || []).forEach((student) => {
      if (student.성명 === inputName) {
        const prevClass = student.이전학적반 || "";
        candidates.push({
          name: student.성명,
          prevClass,
          gender: student.성별,
          currentClass: cls,
          displayName: `${student.성명}(${prevClass}반, ${student.성별})`,
        });
      }
    });
  });
  return candidates;
}

// "이름" 또는 동명이인 식별용 "이름(이전반반, 성별)" 문자열로 현재 반을 찾는다.
export function findStudentClass(classData, studentInput) {
  const nameMatch = studentInput.match(/^(.+?)(?:\(|$)/);
  const baseName = nameMatch ? nameMatch[1] : studentInput;
  const detailMatch = studentInput.match(/\((\d+)반, (남|여)\)/);

  let foundClass = null;
  getValidClasses(classData).forEach((cls) => {
    (classData[cls] || []).forEach((student) => {
      if (student.성명 !== baseName) return;
      if (detailMatch) {
        const prevClass = student.이전학적반 || "";
        if (prevClass === detailMatch[1] && student.성별 === detailMatch[2]) foundClass = cls;
      } else {
        foundClass = cls;
      }
    });
  });
  return foundClass;
}

/* ── 분리조건 위반 계산 ───────────────────────────── */

// 그룹(개별 분리, A:B:C — 서로 전부 다른 반이어야 함) 위반 체크
export function checkGroupViolation(classData, group) {
  const studentClasses = {};
  group.students.forEach((s) => {
    const cls = findStudentClass(classData, s);
    if (cls) studentClasses[s] = cls;
  });

  const violations = [];
  const students = Object.keys(studentClasses);
  for (let i = 0; i < students.length; i++) {
    for (let j = i + 1; j < students.length; j++) {
      if (studentClasses[students[i]] === studentClasses[students[j]]) {
        const [, classNum] = studentClasses[students[i]].split("-");
        violations.push(`${classNum}반`);
      }
    }
  }
  return { hasViolation: violations.length > 0, details: [...new Set(violations)].join(", ") };
}

// 팀(1:N, 지정 학생 ↔ 분리 학생들만 검사) 위반 체크
export function checkTeamViolation(classData, team) {
  const leaderClass = findStudentClass(classData, team.leader);
  if (!leaderClass) return { hasViolation: false, details: "" };

  const violations = team.members.filter((m) => findStudentClass(classData, m) === leaderClass);
  return { hasViolation: violations.length > 0, details: violations.join(", ") };
}

// 반별 위반 개수 (통계 테이블 🚨 뱃지용)
export function calculateClassViolations(classData, separationGroups, separationTeams) {
  const violations = {};
  getValidClasses(classData).forEach((cls) => (violations[cls] = 0));

  separationGroups.forEach((group) => {
    const studentClassMap = {};
    group.students.forEach((s) => {
      const cls = findStudentClass(classData, s);
      if (cls) studentClassMap[s] = cls;
    });
    const students = Object.keys(studentClassMap);
    for (let i = 0; i < students.length; i++) {
      for (let j = i + 1; j < students.length; j++) {
        const c1 = studentClassMap[students[i]];
        const c2 = studentClassMap[students[j]];
        if (c1 === c2) violations[c1] = (violations[c1] || 0) + 1;
      }
    }
  });

  separationTeams.forEach((team) => {
    const leaderClass = findStudentClass(classData, team.leader);
    if (!leaderClass) return;
    team.members.forEach((member) => {
      if (findStudentClass(classData, member) === leaderClass) {
        violations[leaderClass] = (violations[leaderClass] || 0) + 1;
      }
    });
  });

  return violations;
}

// 통계 테이블 위반 툴팁용 상세 텍스트
export function getViolationDetails(classData, separationGroups, separationTeams, cls) {
  const details = [];

  separationGroups.forEach((group) => {
    const studentClassMap = {};
    group.students.forEach((s) => {
      const c = findStudentClass(classData, s);
      if (c) studentClassMap[s] = c;
    });
    const same = Object.keys(studentClassMap).filter((s) => studentClassMap[s] === cls);
    if (same.length >= 2) details.push(`[그룹] ${same.join(" ↔ ")}`);
  });

  separationTeams.forEach((team) => {
    const leaderClass = findStudentClass(classData, team.leader);
    if (leaderClass !== cls) return;
    const violatingMembers = team.members.filter((m) => findStudentClass(classData, m) === cls);
    if (violatingMembers.length > 0) details.push(`[1:N] ${team.leader} ↔ ${violatingMembers.join(", ")}`);
  });

  return details.length > 0 ? details.join("\n") : "위반 없음";
}
