import * as XLSX from "xlsx";
import { loadPdfJs } from "./loadExternalScript";
import { parsePdfText } from "./placementModel";

// 엑셀 원장 파일을 읽어 원본 행 배열(헤더가 키)로 반환한다.
export async function parseExcelFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

// NEIS 반편성결과 PDF를 텍스트로 뽑아 classData 형태로 파싱한다.
export async function parsePdfFile(file) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let allText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    allText += pageText + "\n";
  }

  return parsePdfText(allText);
}
