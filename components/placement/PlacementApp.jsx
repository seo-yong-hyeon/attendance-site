"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileDown,
  GraduationCap,
  Megaphone,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import UploadPanel from "./UploadPanel";
import ClassBoard, { StatsTable, ViewOptionsBar } from "./ClassBoard";
import SeparationModal from "./SeparationModal";
import { parseExcelFile, parsePdfFile } from "./fileProcessing";
import {
  backupToJson,
  exportConfirmationPdf,
  exportNeisExcel,
  exportPublicPdf,
  readBackupFile,
} from "./exporters";
import {
  attachUniqueIdsToClassData,
  buildExcelPrevMap,
  calculateClassViolations,
  cloneBoardState,
  getValidClasses,
  getViolationDetails,
  loadBoardFromStorage,
  loadRecentGrades,
  loadSeparationGroups,
  loadSeparationTeams,
  loadViewOptions,
  saveBoardToStorage,
  saveRecentGrade,
  saveSeparationGroups,
  saveSeparationTeams,
  saveViewOptions,
} from "./placementModel";

const SESSION_KEY = "placement_session_grade";
const EMPTY_BOARD = { classData: {}, history: [], changedStudents: new Set(), movedStudents: new Set() };

export default function PlacementApp() {
  const [grade, setGrade] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setGrade(saved);
  }, []);

  if (!grade) return <GradeGate onEnter={setGrade} />;
  return <PlacementDashboard grade={grade} onChangeGrade={() => setGrade(null)} />;
}

function GradeGate({ onEnter }) {
  const [value, setValue] = useState("");
  const recentGrades = useMemo(() => loadRecentGrades(), []);

  function submit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    saveRecentGrade(trimmed);
    sessionStorage.setItem(SESSION_KEY, trimmed);
    onEnter(trimmed);
  }

  return (
    <div className="mx-auto max-w-sm rounded bg-white p-6 text-center shadow-sm">
      <GraduationCap size={28} className="mx-auto mb-2 text-yellow-500" />
      <h2 className="text-base font-semibold text-slate-800">반편성 — 학년 선택</h2>
      <p className="mt-1 text-xs text-slate-500">
        학년별로 데이터가 나뉘어 저장됩니다. (예: 3학년)
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          list="placementGradeList"
          placeholder="학년 입력 (예: 3학년)"
          autoFocus
          className="rounded border border-slate-200 px-3 py-2 text-sm text-center"
        />
        <datalist id="placementGradeList">
          {recentGrades.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded bg-yellow-400 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
        >
          시작
        </button>
      </form>
    </div>
  );
}

function PlacementDashboard({ grade, onChangeGrade }) {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [excelLoaded, setExcelLoaded] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [excelUploadedAt, setExcelUploadedAt] = useState(null);
  const [pdfUploadedAt, setPdfUploadedAt] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [viewOptions, setViewOptionsState] = useState(() => loadViewOptions(grade));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [separationGroups, setSeparationGroups] = useState([]);
  const [separationTeams, setSeparationTeams] = useState([]);
  const [separationModalOpen, setSeparationModalOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

  const matchingMapsRef = useRef(null);
  const undoStackRef = useRef([]);
  const memoSaveTimer = useRef(null);
  const uploadsNotifiedRef = useRef(false);
  const restoreInputRef = useRef(null);

  // 학년 진입 시 저장된 데이터 로드
  useEffect(() => {
    const loaded = loadBoardFromStorage(grade);
    setBoard(loaded);
    const hasData = getValidClasses(loaded.classData).length > 0;
    setPdfLoaded(hasData);
    setExcelLoaded(hasData); // 원본과 동일: 엑셀 원장 자체는 저장하지 않으므로 재접속 시 매칭 상태만 유지
    setViewOptionsState(loadViewOptions(grade));
    setSeparationGroups(loadSeparationGroups(grade));
    setSeparationTeams(loadSeparationTeams(grade));
    undoStackRef.current = [];
    setUndoAvailable(false);
    uploadsNotifiedRef.current = false;
    setSelectedStudents([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  function persist(nextBoard) {
    setBoard(nextBoard);
    saveBoardToStorage(grade, nextBoard);
  }

  function pushUndoSnapshot() {
    undoStackRef.current = [...undoStackRef.current.slice(-19), cloneBoardState(board)];
    setUndoAvailable(true);
  }

  function checkUploadsReady(nextExcel, nextPdf) {
    if (nextExcel && nextPdf && !uploadsNotifiedRef.current) {
      uploadsNotifiedRef.current = true;
      alert("업로드가 완료되었습니다!");
    }
  }

  async function handleExcelFile(file) {
    setError("");
    setBusy("엑셀 파일을 분석 중입니다...");
    try {
      const rows = await parseExcelFile(file);
      const maps = buildExcelPrevMap(rows);
      matchingMapsRef.current = maps;

      const nextClassData = attachUniqueIdsToClassData(board.classData, maps);
      const nextBoard = { ...board, classData: nextClassData };
      persist(nextBoard);

      setExcelLoaded(true);
      setExcelUploadedAt(new Date());
      checkUploadsReady(true, pdfLoaded);
    } catch (e) {
      console.error(e);
      setError("엑셀 파일 처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePdfFile(file) {
    setError("");
    setBusy("PDF 파일을 분석 중입니다...");
    try {
      let nextClassData = await parsePdfFile(file);
      if (matchingMapsRef.current) {
        nextClassData = attachUniqueIdsToClassData(nextClassData, matchingMapsRef.current);
      }
      const nextBoard = {
        classData: nextClassData,
        history: [],
        changedStudents: new Set(),
        movedStudents: new Set(),
      };
      persist(nextBoard);
      undoStackRef.current = [];
      setUndoAvailable(false);
      setSelectedStudents([]);

      setPdfLoaded(true);
      setPdfUploadedAt(new Date());
      checkUploadsReady(excelLoaded, true);
    } catch (e) {
      console.error(e);
      setError("PDF 파일 처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleApplySample() {
    setSampleModalOpen(false);
    setError("");
    setBusy("샘플 파일(엑셀 + PDF)을 불러오는 중입니다...");
    try {
      const [excelRes, pdfRes] = await Promise.all([
        fetch("/placement/sample.xlsx"),
        fetch("/placement/sample.pdf"),
      ]);
      if (!excelRes.ok) throw new Error("샘플 엑셀 파일을 불러올 수 없습니다.");
      if (!pdfRes.ok) throw new Error("샘플 PDF 파일을 불러올 수 없습니다.");

      const [excelBlob, pdfBlob] = await Promise.all([excelRes.blob(), pdfRes.blob()]);
      const excelFile = new File([excelBlob], "sample.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const pdfFile = new File([pdfBlob], "sample.pdf", { type: "application/pdf" });

      setBusy(null);
      // 엑셀을 먼저 처리해야 매칭 맵이 준비된 상태에서 PDF 파싱 시 학번이 바로 붙는다.
      await handleExcelFile(excelFile);
      await handlePdfFile(pdfFile);
    } catch (e) {
      console.error(e);
      setError(e.message || "샘플 파일 적용 중 오류가 발생했습니다.");
      setBusy(null);
    }
  }

  async function handleRestoreFile(file) {
    try {
      const data = await readBackupFile(file);
      const savedTime = data.savedAt ? new Date(data.savedAt).toLocaleString("ko-KR") : "알 수 없음";
      if (
        !confirm(
          `다음 백업을 복원하시겠습니까?\n\n학교: ${data.schoolName || "알 수 없음"}\n학년: ${
            data.grade || "알 수 없음"
          }\n저장 시간: ${savedTime}`
        )
      ) {
        return;
      }

      const nextBoard = {
        classData: data.classData,
        history: data.history || [],
        changedStudents: new Set(data.changedStudents || []),
        movedStudents: new Set(data.movedStudents || []),
      };
      persist(nextBoard);

      const groups = data.separationGroups || [];
      const teams = data.separationTeams || [];
      setSeparationGroups(groups);
      saveSeparationGroups(grade, groups);
      setSeparationTeams(teams);
      saveSeparationTeams(grade, teams);

      const hasClassData = getValidClasses(nextBoard.classData).length > 0;
      setPdfLoaded(hasClassData);
      setExcelLoaded(hasClassData);
      undoStackRef.current = [];
      setUndoAvailable(false);
      setSelectedStudents([]);

      alert("복원이 완료되었습니다!");
    } catch (e) {
      console.error(e);
      alert(e.message || "백업 파일을 불러오는 중 오류가 발생했습니다.");
    }
  }

  function handleSelect(cls, index) {
    setSelectedStudents((prev) => {
      const exists = prev.some((s) => s.cls === cls && s.index === index);
      if (exists) return prev.filter((s) => !(s.cls === cls && s.index === index));
      return [...prev, { cls, index }];
    });
  }

  function handleMemoChange(cls, index, value) {
    setBoard((prev) => {
      const students = [...(prev.classData[cls] || [])];
      students[index] = { ...students[index], 특이사항: value };
      const next = { ...prev, classData: { ...prev.classData, [cls]: students } };
      clearTimeout(memoSaveTimer.current);
      memoSaveTimer.current = setTimeout(() => saveBoardToStorage(grade, next), 300);
      return next;
    });
  }

  function handleSwap() {
    if (selectedStudents.length !== 2) {
      alert("두 명의 학생을 선택해야 합니다.");
      return;
    }
    const [first, second] = selectedStudents;
    if (first.cls === second.cls) {
      if (!confirm("같은 반 학생 2명을 선택했습니다. 그래도 바꾸시겠습니까?")) {
        setSelectedStudents([]);
        return;
      }
    }

    pushUndoSnapshot();

    const classData = { ...board.classData };
    const firstArr = [...classData[first.cls]];
    const secondArr = first.cls === second.cls ? firstArr : [...classData[second.cls]];
    const temp = firstArr[first.index];
    firstArr[first.index] = secondArr[second.index];
    secondArr[second.index] = temp;
    classData[first.cls] = firstArr;
    classData[second.cls] = secondArr;

    const changedStudents = new Set(board.changedStudents);
    changedStudents.add(`${first.cls}-${firstArr[first.index].성명}`);
    changedStudents.add(`${second.cls}-${secondArr[second.index].성명}`);

    const [, fromClass1] = first.cls.split("-");
    const [, fromClass2] = second.cls.split("-");
    const history = [
      ...board.history,
      `(바꿈) ${fromClass1}반 ${temp.성명} ⇔ ${fromClass2}반 ${firstArr[first.index].성명}`,
    ];

    persist({ classData, history, changedStudents, movedStudents: board.movedStudents });
    setSelectedStudents([]);
  }

  function openMoveMenu() {
    if (selectedStudents.length === 0) {
      alert("이동할 학생을 선택하세요.");
      return;
    }
    setMoveMenuOpen(true);
  }

  function handleMoveTo(targetClass) {
    setMoveMenuOpen(false);
    if (!targetClass) return;
    if (!board.classData[targetClass]) return;

    pushUndoSnapshot();

    const classData = { ...board.classData };
    const movedStudents = new Set(board.movedStudents);
    const history = [...board.history];

    const sortedSelected = [...selectedStudents].sort((a, b) => b.index - a.index);
    const bySource = {};
    sortedSelected.forEach(({ cls, index }) => (bySource[cls] ??= classData[cls] ? [...classData[cls]] : []));
    Object.keys(bySource).forEach((cls) => (classData[cls] = bySource[cls]));

    const moving = [];
    sortedSelected.forEach(({ cls, index }) => {
      const student = classData[cls][index];
      if (!student) return;
      moving.push({ ...student, fromClass: cls });
      classData[cls] = classData[cls].filter((_, i) => i !== index);
    });

    classData[targetClass] = [...classData[targetClass]];
    moving.forEach((student) => {
      const { fromClass, ...clean } = student;
      classData[targetClass].push(clean);
      movedStudents.add(`${targetClass}-${clean.성명}`);
      const [, fromClassNum] = fromClass.split("-");
      const [, toClassNum] = targetClass.split("-");
      history.push(`(이동) ${fromClassNum}반 ${clean.성명} → ${toClassNum}반`);
    });

    persist({ classData, history, changedStudents: board.changedStudents, movedStudents });
    setSelectedStudents([]);
  }

  function handleUndo() {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prevState = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setUndoAvailable(undoStackRef.current.length > 0);
    persist(prevState);
    setSelectedStudents([]);
  }

  function handleSort() {
    if (!confirm("학생 이름을 기준으로 오름차순 정렬하시겠습니까?\n번호도 다시 1번부터 재부여됩니다.")) return;
    const classData = {};
    Object.keys(board.classData).forEach((cls) => {
      const sorted = [...board.classData[cls]].sort((a, b) => a.성명.localeCompare(b.성명, "ko"));
      classData[cls] = sorted.map((s, i) => ({ ...s, 번호: String(i + 1) }));
    });
    persist({ ...board, classData });
    alert("이름 기준 오름차순 정렬이 완료되었습니다.");
  }

  function handleReset() {
    if (!confirm("현재 학년 데이터를 초기화하시겠습니까?\n되돌릴 수 없습니다.")) return;
    persist(EMPTY_BOARD);
    matchingMapsRef.current = null;
    undoStackRef.current = [];
    setUndoAvailable(false);
    setSelectedStudents([]);
    setExcelLoaded(false);
    setPdfLoaded(false);
    uploadsNotifiedRef.current = false;
    alert("데이터가 초기화되었습니다.");
  }

  async function handleExportConfirmationPdf() {
    setBusy("PDF(확인용)를 만드는 중입니다...");
    try {
      await exportConfirmationPdf({ grade, classData: board.classData, history: board.history });
    } catch (e) {
      console.error(e);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function handleExportPublicPdf() {
    setBusy("PDF(공지용)를 만드는 중입니다...");
    try {
      await exportPublicPdf({ grade, classData: board.classData });
    } catch (e) {
      console.error(e);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setBusy(null);
    }
  }

  function handleExportExcel() {
    exportNeisExcel({ grade, classData: board.classData });
  }

  function handleBackup() {
    backupToJson({ grade, board, separationGroups, separationTeams });
  }

  function updateViewOptions(next) {
    setViewOptionsState(next);
    saveViewOptions(grade, next);
  }

  function addGroup(group) {
    const next = [...separationGroups, group];
    setSeparationGroups(next);
    saveSeparationGroups(grade, next);
  }
  function deleteGroup(id) {
    const next = separationGroups.filter((g) => g.id !== id);
    setSeparationGroups(next);
    saveSeparationGroups(grade, next);
  }
  function addTeam(team) {
    const next = [...separationTeams, team];
    setSeparationTeams(next);
    saveSeparationTeams(grade, next);
  }
  function deleteTeam(id) {
    const next = separationTeams.filter((t) => t.id !== id);
    setSeparationTeams(next);
    saveSeparationTeams(grade, next);
  }

  const violationsByClass = useMemo(
    () => calculateClassViolations(board.classData, separationGroups, separationTeams),
    [board.classData, separationGroups, separationTeams]
  );

  function showTooltip(cls, event) {
    const text = getViolationDetails(board.classData, separationGroups, separationTeams, cls);
    const rect = event.target.getBoundingClientRect();
    let top = rect.bottom + 5;
    let left = rect.left;
    let above = false;
    // 화면 아래로 넘치면 위쪽에 표시 (실제 높이는 렌더 후에나 알 수 있어 대략치로 보정)
    if (top + 60 > window.innerHeight) {
      top = rect.top - 65;
      above = true;
    }
    setTooltip({ text, top, left, above });
  }
  function hideTooltip() {
    setTooltip(null);
  }

  const validClasses = getValidClasses(board.classData);
  const hasData = validClasses.length > 0;
  const canSwap = selectedStudents.length === 2;
  const canMove = selectedStudents.length > 0;
  const showDashboard = excelLoaded && pdfLoaded;

  return (
    <div className="space-y-3">
      <p className="rounded bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        이 탭의 자료는 서버로 보내지 않고 이 브라우저에만 저장됩니다. 학년: <b>{grade}</b>{" "}
        <button onClick={onChangeGrade} className="ml-2 underline">
          학년 변경
        </button>
      </p>

      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 rounded bg-white p-3 shadow-sm">
        <button
          onClick={handleSort}
          disabled={!hasData}
          className="flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
        >
          학생 재정렬
        </button>
        <button
          onClick={handleUndo}
          disabled={!undoAvailable}
          className="flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
        >
          <RotateCcw size={14} /> 되돌리기
        </button>
        <button
          onClick={handleReset}
          disabled={!hasData}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-rose-600 disabled:opacity-40"
        >
          <Trash2 size={14} /> 데이터 초기화
        </button>
        <button
          onClick={() => setSeparationModalOpen(true)}
          disabled={!hasData}
          className="flex items-center gap-1.5 rounded bg-slate-700 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <AlertTriangle size={14} /> 떨어뜨릴 학생 {separationGroups.length + separationTeams.length}조
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button
          onClick={handleSwap}
          disabled={!canSwap}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Redo2 size={14} /> 바꾸기
        </button>
        <button
          onClick={openMoveMenu}
          disabled={!canMove}
          className="flex items-center gap-1.5 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          다른 반 이동
        </button>
        {moveMenuOpen && (
          <select
            autoFocus
            defaultValue=""
            onChange={(e) => handleMoveTo(e.target.value)}
            onBlur={() => setMoveMenuOpen(false)}
            className="rounded border border-violet-300 px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              이동할 반 선택
            </option>
            {validClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls.split("-")[1]}반
              </option>
            ))}
          </select>
        )}

        {selectedStudents.length > 0 && (
          <span className="ml-auto text-sm text-slate-500">선택된 학생 {selectedStudents.length}명</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded bg-white p-3 shadow-sm">
        <button
          onClick={handleExportConfirmationPdf}
          disabled={!hasData || busy}
          className="flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <FileDown size={14} /> PDF(확인용)
        </button>
        <button
          onClick={handleExportPublicPdf}
          disabled={!hasData || busy}
          className="flex items-center gap-1.5 rounded bg-orange-500 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Megaphone size={14} /> PDF(공지용)
        </button>
        <button
          onClick={handleExportExcel}
          disabled={!hasData}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Download size={14} /> 엑셀(나이스용)
        </button>
        <button
          onClick={handleBackup}
          disabled={!hasData}
          className="flex items-center gap-1.5 rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Save size={14} /> 백업
        </button>
        <button
          onClick={() => {
            alert("백업한 json파일을 업로드 해 주세요.");
            restoreInputRef.current?.click();
          }}
          className="flex items-center gap-1.5 rounded border border-teal-600 px-3 py-1.5 text-sm font-medium text-teal-700"
        >
          <Upload size={14} /> 복원
        </button>
        <input
          ref={restoreInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleRestoreFile(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => setSampleModalOpen(true)}
          className="ml-auto text-sm text-slate-500 underline hover:text-slate-700"
        >
          📄 샘플 파일
        </button>
      </div>

      {!showDashboard ? (
        <UploadPanel
          excelLoaded={excelLoaded}
          pdfLoaded={pdfLoaded}
          excelUploadedAt={excelUploadedAt}
          pdfUploadedAt={pdfUploadedAt}
          busy={busy}
          onExcelFile={handleExcelFile}
          onPdfFile={handlePdfFile}
          onOpenSampleModal={() => setSampleModalOpen(true)}
        />
      ) : (
        <>
          <ViewOptionsBar viewOptions={viewOptions} onChange={updateViewOptions} />

          {viewOptions.showStats && (
            <StatsTable
              classData={board.classData}
              violationsByClass={violationsByClass}
              onShowTooltip={showTooltip}
              onHideTooltip={hideTooltip}
            />
          )}

          <ClassBoard
            classData={board.classData}
            viewOptions={viewOptions}
            selectedStudents={selectedStudents}
            changedStudents={board.changedStudents}
            movedStudents={board.movedStudents}
            onSelect={handleSelect}
            onMemoChange={handleMemoChange}
            onSwap={handleSwap}
            onMove={openMoveMenu}
            onUndo={handleUndo}
            canSwap={canSwap}
            canMove={canMove}
            canUndo={undoAvailable}
          />

          <div className="rounded bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">변경 이력</h3>
            {board.history.length === 0 ? (
              <p className="text-xs text-slate-400">아직 변경 내역이 없습니다.</p>
            ) : (
              <ul className="space-y-1 text-xs text-slate-600">
                {board.history.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <SeparationModal
        open={separationModalOpen}
        onClose={() => setSeparationModalOpen(false)}
        classData={board.classData}
        groups={separationGroups}
        onAddGroup={addGroup}
        onDeleteGroup={deleteGroup}
        teams={separationTeams}
        onAddTeam={addTeam}
        onDeleteTeam={deleteTeam}
      />

      {tooltip && (
        <div
          className="fixed z-[70] max-w-xs whitespace-pre-line rounded bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.text}
        </div>
      )}

      {sampleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setSampleModalOpen(false)}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">샘플 파일 다운로드</h3>
              <button onClick={() => setSampleModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">원하는 형식을 선택하세요</p>
            <div className="flex gap-2">
              <a
                href="/placement/sample.xlsx"
                download
                className="flex-1 rounded border border-slate-200 py-2 text-center text-sm text-slate-700 hover:bg-slate-50"
              >
                엑셀 샘플 파일
              </a>
              <a
                href="/placement/sample.pdf"
                download
                className="flex-1 rounded border border-slate-200 py-2 text-center text-sm text-slate-700 hover:bg-slate-50"
              >
                PDF 샘플 파일
              </a>
            </div>
            <button
              onClick={handleApplySample}
              className="mt-3 w-full rounded bg-yellow-400 py-2 text-sm font-semibold text-slate-900"
            >
              샘플 바로 적용
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
