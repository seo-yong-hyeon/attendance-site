"use client";

import { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import * as db from "../lib/db";

// QR 안에는 https://주소/checkin?t=토큰 이 들어 있습니다.
function tokenFrom(text) {
  try {
    return new URL(text).searchParams.get("t");
  } catch {
    const m = String(text).match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    return m ? m[0] : null;
  }
}

export default function QrScanner({ onClose, onDone }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [state, setState] = useState("starting");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let stream = null;
    let raf = null;
    let stopped = false;

    async function handle(text) {
      const token = tokenFrom(text);
      if (!token) return false;
      stopped = true;
      setState("sending");
      try {
        const r = await db.checkIn(token);
        setState("ok");
        setMsg(r.already ? "이미 출석 처리되어 있습니다." : "출석되었습니다.");
        onDone?.();
      } catch (e) {
        setState("error");
        setMsg(e.message || "출석 처리에 실패했습니다.");
      }
      return true;
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
      } catch {
        setState("error");
        setMsg("카메라를 열 수 없습니다. 브라우저에서 카메라 권한을 허용해 주세요.");
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play().catch(() => {});
      setState("scanning");

      // 최신 브라우저는 내장 인식기를 씁니다. 없으면 jsQR 로 넘어갑니다.
      let detector = null;
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      let jsQR = null;
      if (!detector) {
        jsQR = (await import("jsqr")).default;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      async function tick() {
        if (stopped) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            if (detector) {
              const found = await detector.detect(video);
              if (found.length && (await handle(found[0].rawValue))) return;
            } else {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height);
              if (code && (await handle(code.data))) return;
            }
          } catch {
            /* 다음 프레임에서 다시 */
          }
        }
        raf = requestAnimationFrame(tick);
      }
      tick();
    }

    start();

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDone]);

  const done = state === "ok" || state === "error";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900">
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex items-center gap-1 text-sm text-white"
      >
        <X size={20} /> 닫기
      </button>

      {!done && (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="h-60 w-60 rounded-2xl border-4 border-yellow-400" />
            <p className="mt-6 rounded-full bg-slate-900 px-4 py-2 text-sm text-white">
              {state === "starting"
                ? "카메라 여는 중…"
                : state === "sending"
                ? "출석 처리 중…"
                : "교실 화면의 QR 을 사각형 안에 맞춰주세요"}
            </p>
          </div>
        </>
      )}

      {done && (
        <div className="flex h-full flex-col items-center justify-center px-6">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full ${
              state === "ok" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          >
            {state === "ok" ? (
              <CheckCircle2 size={52} className="text-white" />
            ) : (
              <XCircle size={52} className="text-white" />
            )}
          </div>

          <p className="mt-6 text-center text-lg font-semibold text-white">
            {msg}
          </p>

          <button
            onClick={onClose}
            className="mt-8 rounded bg-yellow-400 px-8 py-3 text-sm font-semibold text-slate-900"
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
