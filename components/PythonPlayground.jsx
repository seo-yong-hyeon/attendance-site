"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Loader2, Eraser } from "lucide-react";
import { loadExternalScript } from "./placement/loadExternalScript";

const PYODIDE_VERSION = "0.26.4";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const SAMPLE = `print("안녕하세요!")

for i in range(5):
    print(i, i * i)
`;

// turtle 모듈은 Tkinter가 필요해서 브라우저에서 그대로 못 씁니다.
// <canvas> 위에 그리는 대체 구현을 만들어 sys.modules 에 끼워 넣습니다.
// 수업에서 흔히 쓰는 명령(forward/right/pencolor/circle/begin_fill 등)을 지원합니다.
const TURTLE_SHIM = `
import sys as _sys, types as _types, math as _math
from js import document as _document

def _install_turtle():
    _canvas = _document.getElementById("turtle-canvas")
    _ctx = _canvas.getContext("2d")
    _W, _H = _canvas.width, _canvas.height
    _ctx.clearRect(0, 0, _W, _H)
    _ctx.lineCap = "round"

    def _screen_xy(x, y):
        return (_W / 2 + x, _H / 2 - y)

    def _color_str(args):
        if len(args) == 1:
            v = args[0]
            if isinstance(v, (tuple, list)):
                return _rgb(*v)
            return str(v)
        return _rgb(*args)

    def _rgb(r, g, b):
        if isinstance(r, float) and r <= 1 and isinstance(g, float) and isinstance(b, float):
            r, g, b = r * 255, g * 255, b * 255
        return f"rgb({int(r)},{int(g)},{int(b)})"

    class Turtle:
        def __init__(self):
            self._x = 0.0
            self._y = 0.0
            self._heading = 0.0
            self._down = True
            self._pencolor = "black"
            self._fillcolor = "black"
            self._width = 1
            self._visible = True
            self._filling = False
            self._fillpts = []

        def forward(self, dist):
            rad = _math.radians(self._heading)
            self._line_to(self._x + dist * _math.cos(rad), self._y + dist * _math.sin(rad))
        fd = forward
        def backward(self, dist):
            self.forward(-dist)
        bk = backward
        back = backward

        def right(self, angle):
            self._heading -= angle
        rt = right
        def left(self, angle):
            self._heading += angle
        lt = left

        def goto(self, x, y=None):
            if y is None:
                x, y = x[0], x[1]
            self._line_to(x, y)
        setpos = goto
        setposition = goto
        def setx(self, x):
            self.goto(x, self._y)
        def sety(self, y):
            self.goto(self._x, y)
        def home(self):
            self.goto(0, 0)
            self._heading = 0.0

        def setheading(self, angle):
            self._heading = angle
        seth = setheading
        def heading(self):
            return self._heading
        def position(self):
            return (self._x, self._y)
        pos = position
        def xcor(self):
            return self._x
        def ycor(self):
            return self._y
        def distance(self, x, y=None):
            if y is None:
                x, y = x[0], x[1]
            return _math.hypot(x - self._x, y - self._y)

        def _line_to(self, nx, ny):
            if self._down:
                sx, sy = _screen_xy(self._x, self._y)
                ex, ey = _screen_xy(nx, ny)
                _ctx.strokeStyle = self._pencolor
                _ctx.lineWidth = self._width
                _ctx.beginPath()
                _ctx.moveTo(sx, sy)
                _ctx.lineTo(ex, ey)
                _ctx.stroke()
            if self._filling:
                self._fillpts.append((nx, ny))
            self._x, self._y = nx, ny

        def penup(self):
            self._down = False
        up = penup
        pu = penup
        def pendown(self):
            self._down = True
        down = pendown
        pd = pendown
        def isdown(self):
            return self._down

        def pensize(self, w=None):
            if w is None:
                return self._width
            self._width = w
        width = pensize

        def pencolor(self, *args):
            if not args:
                return self._pencolor
            self._pencolor = _color_str(args)
        def fillcolor(self, *args):
            if not args:
                return self._fillcolor
            self._fillcolor = _color_str(args)
        def color(self, *args):
            if not args:
                return (self._pencolor, self._fillcolor)
            if len(args) == 1:
                c = _color_str((args[0],))
                self._pencolor = c
                self._fillcolor = c
            else:
                self._pencolor = _color_str((args[0],))
                self._fillcolor = _color_str((args[1],))

        def begin_fill(self):
            self._filling = True
            self._fillpts = [(self._x, self._y)]
        def end_fill(self):
            if self._filling and len(self._fillpts) > 2:
                sx, sy = _screen_xy(*self._fillpts[0])
                _ctx.beginPath()
                _ctx.moveTo(sx, sy)
                for px, py in self._fillpts[1:]:
                    ex, ey = _screen_xy(px, py)
                    _ctx.lineTo(ex, ey)
                _ctx.closePath()
                _ctx.fillStyle = self._fillcolor
                _ctx.fill()
            self._filling = False
            self._fillpts = []

        def circle(self, radius, extent=360, steps=None):
            steps = steps or max(int(abs(extent) / 5), 8)
            step_len = 2 * _math.pi * abs(radius) * (extent / 360) / steps
            sign = 1 if radius >= 0 else -1
            angle_step = (extent / steps) * sign
            for _ in range(steps):
                self.forward(step_len)
                self.left(angle_step)

        def dot(self, size=None, *color):
            size = size or max(self._width + 4, 6)
            c = _color_str(color) if color else self._pencolor
            sx, sy = _screen_xy(self._x, self._y)
            _ctx.beginPath()
            _ctx.arc(sx, sy, size / 2, 0, 2 * _math.pi)
            _ctx.fillStyle = c
            _ctx.fill()

        def write(self, text, move=False, align="left", font=("Arial", 12, "normal")):
            sx, sy = _screen_xy(self._x, self._y)
            size = font[1] if len(font) > 1 else 12
            fam = font[0] if font else "Arial"
            _ctx.fillStyle = self._pencolor
            _ctx.font = f"{size}px {fam}"
            _ctx.textAlign = align if align in ("left", "center", "right") else "left"
            _ctx.fillText(str(text), sx, sy)

        def clear(self):
            _ctx.clearRect(0, 0, _W, _H)
        def reset(self):
            self.clear()
            self._x = self._y = 0.0
            self._heading = 0.0
            self._down = True

        def hideturtle(self):
            self._visible = False
        ht = hideturtle
        def showturtle(self):
            self._visible = True
        st = showturtle
        def isvisible(self):
            return self._visible
        def speed(self, *a, **k):
            pass
        def shape(self, *a, **k):
            pass

    class Screen:
        def bgcolor(self, *args):
            _canvas.style.background = _color_str(args) if args else ""
        def title(self, *a, **k):
            pass
        def setup(self, *a, **k):
            pass
        def screensize(self, *a, **k):
            pass
        def exitonclick(self, *a, **k):
            pass
        def mainloop(self, *a, **k):
            pass
        def clear(self):
            _ctx.clearRect(0, 0, _W, _H)
        def colormode(self, *a, **k):
            pass
        def tracer(self, *a, **k):
            pass
        def update(self, *a, **k):
            pass

    mod = _types.ModuleType("turtle")
    mod.Turtle = Turtle
    mod.Screen = Screen

    _default = {"t": None, "s": None}
    def _pen():
        if _default["t"] is None:
            _default["t"] = Turtle()
        return _default["t"]
    def _screen():
        if _default["s"] is None:
            _default["s"] = Screen()
        return _default["s"]

    _pen_methods = [
        "forward", "fd", "backward", "bk", "back", "right", "rt", "left", "lt",
        "goto", "setpos", "setposition", "setx", "sety", "home", "setheading", "seth",
        "heading", "position", "pos", "xcor", "ycor", "distance", "penup", "up", "pu",
        "pendown", "down", "pd", "isdown", "pensize", "width", "pencolor", "fillcolor",
        "color", "begin_fill", "end_fill", "circle", "dot", "write", "clear", "reset",
        "hideturtle", "ht", "showturtle", "st", "isvisible", "speed", "shape",
    ]
    def _bind(name):
        def _f(*a, **k):
            return getattr(_pen(), name)(*a, **k)
        return _f
    for _name in _pen_methods:
        setattr(mod, _name, _bind(_name))

    mod.bgcolor = lambda *a, **k: _screen().bgcolor(*a, **k)
    mod.title = lambda *a, **k: _screen().title(*a, **k)
    mod.setup = lambda *a, **k: _screen().setup(*a, **k)
    mod.screensize = lambda *a, **k: _screen().screensize(*a, **k)
    mod.exitonclick = lambda *a, **k: _screen().exitonclick(*a, **k)
    mod.mainloop = lambda *a, **k: _screen().mainloop(*a, **k)
    mod.done = lambda *a, **k: _screen().mainloop(*a, **k)
    mod.colormode = lambda *a, **k: _screen().colormode(*a, **k)
    mod.tracer = lambda *a, **k: _screen().tracer(*a, **k)
    mod.update = lambda *a, **k: _screen().update(*a, **k)

    _sys.modules["turtle"] = mod

_install_turtle()
`;

export default function PythonPlayground() {
  const [code, setCode] = useState(SAMPLE);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | running | failed
  const pyodideRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadExternalScript(
          `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`
        );
        const pyodide = await window.loadPyodide({ indexURL: INDEX_URL });
        if (cancelled) return;

        pyodide.setStdout({ batched: (s) => setOutput((o) => o + s + "\n") });
        pyodide.setStderr({ batched: (s) => setOutput((o) => o + s + "\n") });
        // input() 은 브라우저 prompt 창으로 값을 받습니다. 취소를 누르면 EOF 로 처리됩니다.
        pyodide.setStdin({
          stdin: () => {
            let value;
            try {
              value = window.prompt("input() — 값을 입력하세요");
            } catch {
              setOutput(
                (o) =>
                  o +
                  "\n[이 브라우저(카카오톡 인앱 등)는 입력창을 지원하지 않습니다. Chrome/Safari에서 열어주세요.]\n"
              );
              return null;
            }
            if (value === null) return null;
            setOutput((o) => o + "입력> " + value + "\n");
            return value;
          },
        });

        pyodideRef.current = pyodide;
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setOutput("파이썬 실행 환경을 불러오지 못했습니다: " + e.message);
          setStatus("failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    const pyodide = pyodideRef.current;
    if (!pyodide || status === "running") return;

    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    canvas?.style.removeProperty("background");

    setOutput("");
    setStatus("running");
    try {
      // 매 실행마다 turtle 을 새로 깔아서 이전 실행의 위치/색 상태가 안 남게 합니다.
      await pyodide.runPythonAsync(TURTLE_SHIM);
      await pyodide.runPythonAsync(code);
    } catch (e) {
      setOutput((o) => o + String(e));
    } finally {
      setStatus("ready");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target;
      const { selectionStart, selectionEnd } = el;
      const next = code.slice(0, selectionStart) + "    " + code.slice(selectionEnd);
      setCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = selectionStart + 4;
      });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  }

  const busy = status === "loading" || status === "running";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">파이썬 코드 실행</h1>
            <p className="text-xs text-slate-500">
              브라우저 안에서만 실행됩니다. 서버로는 아무것도 보내지 않습니다.
              input() 과 turtle 그래픽도 지원합니다.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-lg">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="h-64 w-full resize-y border-b border-slate-200 p-4 font-mono text-sm text-slate-900 outline-none"
          />

          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <button
              onClick={run}
              disabled={busy}
              className="flex items-center gap-1.5 rounded bg-yellow-400 px-4 py-1.5 text-sm font-semibold text-slate-900 disabled:bg-slate-200 disabled:text-slate-400"
            >
              {status === "loading" ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  준비 중…
                </>
              ) : status === "running" ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  실행 중…
                </>
              ) : (
                <>
                  <Play size={15} />
                  실행 (Ctrl+Enter)
                </>
              )}
            </button>

            <button
              onClick={() => setOutput("")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:text-slate-300"
            >
              <Eraser size={14} />
              결과 지우기
            </button>
          </div>

          <pre className="min-h-[6rem] whitespace-pre-wrap break-words p-4 font-mono text-sm text-slate-800">
            {output || (status === "loading" ? "파이썬 실행 환경을 내려받는 중입니다 (처음 한 번은 시간이 걸려요)…" : "")}
          </pre>

          <div className="border-t border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs text-slate-400">그래픽 출력 (turtle)</p>
            <canvas
              ref={canvasRef}
              id="turtle-canvas"
              width={460}
              height={320}
              className="mx-auto block rounded border border-slate-200 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
