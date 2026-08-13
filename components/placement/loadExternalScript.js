// CDN <script> 태그를 필요할 때만 한 번씩 불러오는 헬퍼.
// pdf.js / jsPDF / jspdf-autotable / 한글 폰트는 전부 무거운 리소스라
// 번들에 넣지 않고, 실제로 업로드/내보내기를 쓸 때만 원본과 동일한 CDN에서 로드한다.

const loaded = new Map();

export function loadExternalScript(src) {
  if (typeof window === "undefined") return Promise.resolve();
  if (loaded.has(src)) return loaded.get(src);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`)));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`));
    document.head.appendChild(script);
  });

  loaded.set(src, promise);
  return promise;
}

export async function loadPdfJs() {
  await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return pdfjsLib;
}

export async function loadJsPdf() {
  await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  await loadExternalScript(
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"
  );
  return window.jspdf.jsPDF;
}

export async function loadKoreanFont() {
  await loadExternalScript("/placement/nuclass_font.js");
  return {
    regular: window.NUCLASS_FONT_BASE64,
    bold: window.NUCLASS_FONT_BOLD_BASE64,
  };
}
