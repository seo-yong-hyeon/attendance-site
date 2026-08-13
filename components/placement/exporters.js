import * as XLSX from "xlsx";
import { loadJsPdf, loadKoreanFont } from "./loadExternalScript";
import { getSortedValidClasses } from "./placementModel";

const SCHOOL = "세연중학교";

function getFileTimestamp() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yy}${mm}${dd}_${hh}${mi}${ss}`;
}

// 한글 이름: 두번째 글자(또는 중간 전체, 4글자 이상) 마스킹. 공백 포함(영문 추정) 이름은 단어별 처리.
export function maskName(name) {
  if (!name) return "";
  if (name.includes(" ")) {
    return name
      .split(" ")
      .map((word) => {
        if (word.length <= 1) return word;
        if (word.length === 2) return word[0] + "*";
        return word.slice(0, 2) + "*".repeat(word.length - 2);
      })
      .join(" ");
  }
  const len = name.length;
  if (len <= 1) return name;
  if (len === 2) return name[0] + "*";
  if (len === 3) return name[0] + "*" + name[2];
  return name[0] + "*".repeat(len - 2) + name[len - 1];
}

async function registerPdfFont(doc) {
  const font = await loadKoreanFont();
  if (!font.regular) throw new Error("NUCLASS_FONT_BASE64가 없습니다.");
  doc.addFileToVFS("NotoSansKR-Regular.ttf", font.regular);
  doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "normal");
  doc.addFileToVFS("NotoSansKR-Bold.ttf", font.bold);
  doc.addFont("NotoSansKR-Bold.ttf", "NotoSansKR", "bold");
  doc.setFont("NotoSansKR", "normal");
}

function buildStatsData(classData, sortedClasses) {
  let prevMax = 0;
  sortedClasses.forEach((cls) => {
    (classData[cls] || []).forEach((s) => {
      const v = parseInt(s.이전학적반, 10);
      if (!isNaN(v)) prevMax = Math.max(prevMax, v);
    });
  });
  prevMax = Math.max(prevMax, 1);

  const headerRow1 = [
    { content: "구분", rowSpan: 2 },
    { content: "인원", rowSpan: 2 },
    { content: "남", rowSpan: 2 },
    { content: "여", rowSpan: 2 },
    { content: "이전 반", colSpan: prevMax },
    { content: "성적\n평균", rowSpan: 2 },
    { content: "최고점\n(이름)", rowSpan: 2 },
    { content: "최저점\n(이름)", rowSpan: 2 },
  ];
  const headerRow2 = Array.from({ length: prevMax }, (_, i) => `${i + 1}반`);
  const head = [headerRow1, headerRow2];

  const body = sortedClasses.map((cls) => {
    const students = classData[cls] || [];
    let totalScore = 0;
    let maxScore = -Infinity;
    let minScore = Infinity;
    let maxStudent = "";
    let minStudent = "";
    let maleCount = 0;
    let femaleCount = 0;
    const previousClassCount = Array(prevMax).fill(0);

    students.forEach((student) => {
      const score = parseFloat(student.기준성적) || 0;
      if (score > maxScore) {
        maxScore = score;
        maxStudent = student.성명;
      }
      if (score < minScore) {
        minScore = score;
        minStudent = student.성명;
      }
      totalScore += score;
      if (student.성별 === "남") maleCount++;
      else if (student.성별 === "여") femaleCount++;
      const prevClass = parseInt(student.이전학적반, 10) - 1;
      if (!isNaN(prevClass) && prevClass >= 0 && prevClass < prevMax) previousClassCount[prevClass]++;
    });

    const avgScore = students.length ? (totalScore / students.length).toFixed(2) : "-";
    const maxText = maxScore !== -Infinity ? `${maxScore}\n(${maxStudent})` : "-";
    const minText = minScore !== Infinity ? `${minScore}\n(${minStudent})` : "-";

    return [
      cls,
      String(students.length),
      String(maleCount),
      String(femaleCount),
      ...previousClassCount.map(String),
      avgScore,
      maxText,
      minText,
    ];
  });

  return { head, body, prevMax };
}

function drawInnerVerticalLines(doc, colCount) {
  return function didDrawCell(data) {
    if (data.column.index < colCount - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(
        data.cell.x + data.cell.width,
        data.cell.y,
        data.cell.x + data.cell.width,
        data.cell.y + data.cell.height
      );
    }
  };
}

// PDF(확인용) — 통계 + 변경 이력 + 반별 전체(점수 포함)
export async function exportConfirmationPdf({ grade, classData, history }) {
  const sortedClasses = getSortedValidClasses(classData);
  if (sortedClasses.length === 0) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }

  const jsPDF = await loadJsPdf();
  const doc = new jsPDF();

  try {
    await registerPdfFont(doc);
  } catch (e) {
    console.error(e);
    alert("PDF 한글 폰트 로딩에 실패했습니다.");
    return;
  }

  const nowDate = new Date();
  const now = nowDate.toLocaleString("ko-KR");
  const year = nowDate.getFullYear();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  doc.setFontSize(14);
  doc.text(`${SCHOOL} ${grade} [반편성] 반편성내역`, centerX, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`(${now})`, centerX, 22, { align: "center" });

  let yPos = 30;
  doc.setFontSize(12);
  doc.text("통계", 14, yPos);
  yPos += 4;

  const { head: statsHead, body: statsBody, prevMax } = buildStatsData(classData, sortedClasses);

  const marginLeft = 6;
  const marginRight = 5;
  const availableWidth = pageWidth - marginLeft - marginRight;
  const idxAvg = 4 + prevMax;
  const idxMax = 5 + prevMax;
  const idxMin = 6 + prevMax;
  const wCategory = 11;
  const wTotal = 9;
  const wMale = 8;
  const wFemale = 8;
  const wAvg = 13;
  const wMax = 22;
  const wMin = 22;
  const fixed = wCategory + wTotal + wMale + wFemale + wAvg + wMax + wMin;
  const wPrev = Math.max(9, Math.floor((availableWidth - fixed) / prevMax));

  const statsColumnStyles = {
    0: { cellWidth: wCategory },
    1: { cellWidth: wTotal },
    2: { cellWidth: wMale },
    3: { cellWidth: wFemale },
    [idxAvg]: { cellWidth: wAvg },
    [idxMax]: { cellWidth: wMax },
    [idxMin]: { cellWidth: wMin },
  };
  for (let i = 0; i < prevMax; i++) statsColumnStyles[4 + i] = { cellWidth: wPrev };

  doc.autoTable({
    startY: yPos,
    head: statsHead,
    body: statsBody,
    margin: { left: marginLeft, right: marginRight },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [0, 0, 0],
      font: "NotoSansKR",
      halign: "center",
      valign: "middle",
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
    },
    headStyles: {
      fontSize: 8,
      fillColor: [76, 165, 80],
      textColor: [255, 255, 255],
      halign: "center",
      fontStyle: "bold",
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
    },
    columnStyles: statsColumnStyles,
  });

  yPos = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(12);
  doc.text("변경 이력", 14, yPos);
  yPos += 6;
  doc.setFontSize(9);

  const bottomMargin = 12;
  const lineHeight = 6;
  if (history.length === 0) {
    doc.text("- 변경 이력이 없습니다.", 14, yPos);
    yPos += lineHeight;
  } else {
    history.forEach((entry) => {
      if (yPos + lineHeight > pageHeight - bottomMargin) {
        doc.addPage();
        yPos = 15;
        doc.setFontSize(12);
        doc.text("변경 이력(계속)", 14, yPos);
        yPos += 6;
        doc.setFontSize(9);
      }
      doc.text(`- ${entry}`, 14, yPos);
      yPos += lineHeight;
    });
  }

  sortedClasses.forEach((cls) => {
    const [clsGrade, classNum] = cls.split("-");
    const students = classData[cls];
    doc.addPage();
    let classY = 15;
    doc.setFontSize(12);
    const nextGradeNum = parseInt(grade.replace(/[^0-9]/g, ""), 10) + 1;
    doc.text(`${SCHOOL} ${year}학년도 ${nextGradeNum}학년 ${classNum}반`, 14, classY);
    classY += 7;

    const tableData = students.map((s) => [
      clsGrade,
      classNum,
      s.번호,
      s.성명,
      s.생년월일,
      s.성별,
      s.기준성적,
      s.이전학적학년 || "",
      s.이전학적반 || "",
      s.이전학적번호 || "",
    ]);

    doc.autoTable({
      startY: classY,
      head: [["학년", "반", "번호", "성명", "생년월일", "성별", "기준성적", "이전학년", "이전반", "이전번호"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], font: "NotoSansKR", halign: "center", lineWidth: 0 },
      headStyles: {
        fontSize: 7,
        fillColor: [76, 165, 80],
        textColor: [255, 255, 255],
        halign: "center",
        fontStyle: "bold",
        lineColor: [200, 200, 200],
        lineWidth: 0,
      },
      didDrawCell: drawInnerVerticalLines(doc, 10),
    });
  });

  doc.save(`${SCHOOL}_${grade}_반편성결과_확인용_${getFileTimestamp()}.pdf`);
}

// PDF(공지용) — 통계/이력/점수 없음, 이름 마스킹
export async function exportPublicPdf({ grade, classData }) {
  const sortedClasses = getSortedValidClasses(classData);
  if (sortedClasses.length === 0) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }

  const jsPDF = await loadJsPdf();
  const doc = new jsPDF();

  try {
    await registerPdfFont(doc);
  } catch (e) {
    console.error(e);
    alert("PDF 한글 폰트 로딩에 실패했습니다.");
    return;
  }

  const year = new Date().getFullYear();

  sortedClasses.forEach((cls, idx) => {
    const [clsGrade, classNum] = cls.split("-");
    const students = classData[cls];
    if (idx > 0) doc.addPage();

    let classY = 15;
    doc.setFontSize(12);
    const nextGradeNum = parseInt(grade.replace(/[^0-9]/g, ""), 10) + 1;
    doc.text(`${SCHOOL} ${year}학년도 ${nextGradeNum}학년 ${classNum}반`, 14, classY);
    classY += 7;

    const tableData = students.map((s) => [
      clsGrade,
      classNum,
      s.번호,
      maskName(s.성명),
      s.생년월일,
      s.성별,
      s.이전학적학년 || "",
      s.이전학적반 || "",
      s.이전학적번호 || "",
    ]);

    doc.autoTable({
      startY: classY,
      head: [["학년", "반", "번호", "성명", "생년월일", "성별", "이전학년", "이전반", "이전번호"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], font: "NotoSansKR", halign: "center", lineWidth: 0 },
      headStyles: {
        fontSize: 7,
        fillColor: [76, 165, 80],
        textColor: [255, 255, 255],
        halign: "center",
        fontStyle: "bold",
        lineColor: [200, 200, 200],
        lineWidth: 0,
      },
      didDrawCell: drawInnerVerticalLines(doc, 9),
    });
  });

  doc.save(`${SCHOOL}_${grade}_반편성결과_공지용_${getFileTimestamp()}.pdf`);
}

// 엑셀(나이스용) 내보내기
export function exportNeisExcel({ grade, classData }) {
  const sortedClasses = getSortedValidClasses(classData);
  if (sortedClasses.length === 0) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }

  const allData = [];
  sortedClasses.forEach((cls) => {
    const [, classNum] = cls.split("-");
    (classData[cls] || []).forEach((student) => {
      allData.push({
        학번: String(student.고유학번 || ""),
        성명: student.성명,
        이전주야과정구분: "주간",
        이전학년: student.이전학적학년 ? `${student.이전학적학년}학년` : "",
        이전반: String(student.이전학적반 || ""),
        이전번호: student.이전학적번호 || "",
        진급주야과정구분: "주간",
        진급학년: `${grade}학년`,
        진급반코드: String(classNum).padStart(2, "0"),
        진급반번호: student.번호,
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(allData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${SCHOOL}_${grade}`.slice(0, 31));

  ws["!cols"] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
    { wch: 15 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ];
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = 1; r <= range.e.r; r++) {
    const cellAddress = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[cellAddress]) {
      ws[cellAddress].z = "@";
      ws[cellAddress].t = "s";
    }
  }

  XLSX.writeFile(wb, `${SCHOOL}_${grade}_반편성결과.xlsx`);
}

// 백업(JSON 다운로드)
export function backupToJson({ grade, board, separationGroups, separationTeams }) {
  if (Object.keys(board.classData).length === 0) {
    alert("백업할 데이터가 없습니다.");
    return;
  }

  const dataToSave = {
    schoolName: SCHOOL,
    grade,
    savedAt: new Date().toISOString(),
    classData: board.classData,
    history: board.history,
    changedStudents: Array.from(board.changedStudents),
    movedStudents: Array.from(board.movedStudents),
    separationGroups,
    separationTeams,
  };

  const jsonString = JSON.stringify(dataToSave, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 10);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${SCHOOL}_${grade}_백업_${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 복원(JSON 업로드) — 파일을 읽어 검증된 데이터를 반환한다. 실제 반영은 호출부에서 확인(confirm) 후 처리.
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith(".json")) {
      reject(new Error("JSON 파일만 불러올 수 있습니다."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.classData) throw new Error("유효하지 않은 백업 파일입니다.");
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("백업 파일을 읽지 못했습니다."));
    reader.readAsText(file);
  });
}
