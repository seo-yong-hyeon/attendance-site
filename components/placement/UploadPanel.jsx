"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";

function formatTime(d) {
  if (!d) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function DropZone({ kind, done, uploadedAt, accept, onFile, icon: Icon, title, guide, tint }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!accept(file)) {
      alert("올바른 파일 형식이 아닙니다.");
      return;
    }
    onFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative flex cursor-pointer flex-col items-center gap-2 rounded border-2 border-dashed p-6 text-center transition ${
        dragOver ? "border-yellow-400 bg-yellow-50" : `border-slate-300 ${tint}`
      }`}
    >
      {done && (
        <span className="absolute right-2 top-2 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-white">
          업로드 완료
        </span>
      )}
      <Icon size={26} className="text-slate-400" />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-500">{guide}</p>
      {done && uploadedAt && (
        <p className="text-xs text-slate-400">마지막 업로드: {formatTime(uploadedAt)}</p>
      )}
      <span className="mt-1 rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white">
        파일 선택
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={kind === "excel" ? ".xlsx,.xls" : "application/pdf"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function UploadPanel({
  excelLoaded,
  pdfLoaded,
  excelUploadedAt,
  pdfUploadedAt,
  busy,
  onExcelFile,
  onPdfFile,
  onOpenSampleModal,
}) {
  return (
    <div className="rounded bg-white p-4 shadow-sm">
      {busy ? (
        <div className="flex flex-col items-center gap-3 py-14 text-slate-500">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">{busy}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <DropZone
              kind="excel"
              done={excelLoaded}
              uploadedAt={excelUploadedAt}
              accept={(f) => /\.(xlsx|xls)$/i.test(f.name)}
              onFile={onExcelFile}
              icon={FileSpreadsheet}
              tint="bg-blue-50/40"
              title="엑셀 파일을 업로드해주세요"
              guide={
                "학적 - 진급대상자 반편성관리 - 일괄반편성 작업 후\n반편성자료생성 - 자료내리기 - 재학생 - 내리기\n\n엑셀 파일만 업로드 가능합니다"
              }
            />
            <DropZone
              kind="pdf"
              done={pdfLoaded}
              uploadedAt={pdfUploadedAt}
              accept={(f) => f.type === "application/pdf"}
              onFile={onPdfFile}
              icon={FileText}
              tint="bg-orange-50/40"
              title="PDF 파일을 업로드해주세요"
              guide={
                "나이스 - 학적 - 진급대상자 반편성관리 - 일괄반편성 작업 후\n반편성결과조회 - 반편성조회(배정반기준) - 전체반 옵션 선택 - 출력 - PDF 저장\n\n엑셀 등을 변환한 PDF 파일은 호환되지 않습니다"
              }
            />
          </div>
          {onOpenSampleModal && (
            <button
              onClick={onOpenSampleModal}
              className="mt-4 text-sm text-slate-500 underline hover:text-slate-700"
            >
              📄 샘플 파일로 미리 살펴보기
            </button>
          )}
        </>
      )}
    </div>
  );
}
