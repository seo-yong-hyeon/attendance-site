"use client";

import { useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import { checkGroupViolation, checkTeamViolation, findStudentCandidates } from "./placementModel";

function baseName(input) {
  return input.match(/^(.+?)(?:\(|$)/)?.[1] ?? input;
}

// 이름 입력값을 학생 후보와 대조해서, 동명이인이면 선택 콜백을 통해 고르게 한다.
function resolveName(classData, value, { onResolved, openPicker }) {
  const candidates = findStudentCandidates(classData, value);
  if (candidates.length === 0) {
    alert("학생 목록에 없는 이름입니다. 정확한 이름을 입력해주세요.");
    return;
  }
  if (candidates.length > 1) {
    openPicker(candidates, onResolved);
    return;
  }
  onResolved(candidates[0].name);
}

function CandidatePicker({ candidates, onPick, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">동명이인입니다. 학생을 선택하세요.</h3>
        <div className="space-y-2">
          {candidates.map((c) => {
            const [, currentClassNum] = c.currentClass.split("-");
            return (
              <button
                key={c.displayName}
                onClick={() => onPick(c.displayName)}
                className="w-full rounded border-2 border-slate-200 p-3 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50"
              >
                <div className="font-semibold text-slate-800">
                  {c.name} ({c.gender})
                </div>
                <div className="text-xs text-slate-500">
                  이전: {c.prevClass}반 → 현재: {currentClassNum}반
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full rounded bg-slate-600 py-2 text-sm text-white hover:bg-slate-700"
        >
          취소
        </button>
      </div>
    </div>
  );
}

function GroupTab({ classData, groups, onAdd, onDelete }) {
  const [input, setInput] = useState("");
  const [tags, setTags] = useState([]);
  const [reason, setReason] = useState("");
  const [picker, setPicker] = useState(null);

  function addTag(name) {
    if (tags.includes(name)) {
      alert("이미 추가된 학생입니다.");
      return;
    }
    setTags((prev) => [...prev, name]);
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    resolveName(classData, value, {
      onResolved: addTag,
      openPicker: (candidates, onResolved) => setPicker({ candidates, onResolved }),
    });
  }

  function submit() {
    if (tags.length < 2) {
      alert("최소 2명 이상의 학생을 선택해야 합니다.");
      return;
    }
    onAdd({ id: Date.now(), students: tags, reason: reason.trim() || "(사유 없음)" });
    setTags([]);
    setInput("");
    setReason("");
  }

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">같은 반이 되면 안 되는 학생들을 그룹으로 추가하세요.</p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="학생 이름 입력 후 Enter"
        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs text-rose-800">
            {t}
            <button onClick={() => setTags(tags.filter((x) => x !== t))}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="사유 (선택사항)"
        className="mt-2 w-full rounded border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        onClick={submit}
        disabled={tags.length < 2}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-rose-600 py-2 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        <Plus size={14} /> 그룹 추가
      </button>

      <hr className="my-4 border-slate-200" />

      <div className="space-y-2">
        {groups.length === 0 && <p className="text-xs text-slate-400">추가된 그룹이 없습니다.</p>}
        {groups.map((group) => {
          const v = checkGroupViolation(classData, group);
          return (
            <div key={group.id} className="rounded border-l-4 border-rose-400 bg-rose-50/50 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{group.students.join(" ↔ ")}</p>
                  <p className="text-xs text-slate-500">{group.reason}</p>
                  <p className={`mt-1 text-xs ${v.hasViolation ? "text-rose-600" : "text-emerald-600"}`}>
                    {v.hasViolation ? `⚠️ 같은 반: ${v.details}` : "✓ 모두 다른 반"}
                  </p>
                </div>
                <button onClick={() => onDelete(group.id)} className="text-slate-400 hover:text-rose-600">
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {picker && (
        <CandidatePicker
          candidates={picker.candidates}
          onPick={(name) => {
            picker.onResolved(name);
            setPicker(null);
          }}
          onCancel={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function TeamTab({ classData, teams, onAdd, onDelete }) {
  const [leaderInput, setLeaderInput] = useState("");
  const [leader, setLeader] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState([]);
  const [reason, setReason] = useState("");
  const [picker, setPicker] = useState(null);

  function handleLeaderKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = leaderInput.trim();
    if (!value) return;
    resolveName(classData, value, {
      onResolved: (name) => {
        setLeader(name);
        setLeaderInput("");
      },
      openPicker: (candidates, onResolved) => setPicker({ candidates, onResolved }),
    });
  }

  function handleMemberKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = memberInput.trim();
    if (!value) return;
    if (leader && baseName(value) === baseName(leader)) {
      alert("지정 학생과 같은 학생은 분리 학생으로 추가할 수 없습니다.");
      return;
    }
    resolveName(classData, value, {
      onResolved: (name) => {
        if (members.includes(name)) {
          alert("이미 추가된 학생입니다.");
          return;
        }
        setMembers((prev) => [...prev, name]);
        setMemberInput("");
      },
      openPicker: (candidates, onResolved) => setPicker({ candidates, onResolved }),
    });
  }

  function submit() {
    if (!leader) {
      alert("지정 학생을 선택해주세요.");
      return;
    }
    if (members.length === 0) {
      alert("최소 1명의 분리 학생을 추가해주세요.");
      return;
    }
    onAdd({ id: Date.now(), leader, members, reason: reason.trim() || "(사유 없음)" });
    setLeader("");
    setMembers([]);
    setLeaderInput("");
    setMemberInput("");
    setReason("");
  }

  return (
    <div>
      <p className="mb-2 text-xs leading-relaxed text-slate-500">
        <b>지정 학생</b>과 <b>분리 학생들</b>은 다른 반이어야 합니다. (분리 학생끼리는 같은 반 가능)
      </p>

      <label className="mb-1 block text-xs font-medium text-slate-600">지정 학생 (1명)</label>
      <input
        value={leaderInput}
        onChange={(e) => setLeaderInput(e.target.value)}
        onKeyDown={handleLeaderKeyDown}
        placeholder="지정 학생 이름 입력 후 Enter"
        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
      />
      {leader && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs text-rose-800">
          {leader}
          <button onClick={() => setLeader("")}>
            <X size={12} />
          </button>
        </span>
      )}

      <label className="mb-1 mt-3 block text-xs font-medium text-slate-600">분리 학생 (N명)</label>
      <input
        value={memberInput}
        onChange={(e) => setMemberInput(e.target.value)}
        onKeyDown={handleMemberKeyDown}
        placeholder="분리해야 할 학생 이름 입력 후 Enter"
        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {members.map((m) => (
          <span key={m} className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs text-blue-800">
            {m}
            <button onClick={() => setMembers(members.filter((x) => x !== m))}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="사유 (선택사항)"
        className="mt-2 w-full rounded border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        onClick={submit}
        disabled={!leader || members.length === 0}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-rose-600 py-2 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        <Plus size={14} /> 그룹 추가
      </button>

      <hr className="my-4 border-slate-200" />

      <div className="space-y-2">
        {teams.length === 0 && <p className="text-xs text-slate-400">추가된 팀이 없습니다.</p>}
        {teams.map((team) => {
          const v = checkTeamViolation(classData, team);
          return (
            <div key={team.id} className="rounded border-l-4 border-rose-400 bg-rose-50/50 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">
                    <span className="text-rose-600">지정 학생:</span> {team.leader} /{" "}
                    <span className="text-blue-600">분리 학생:</span> {team.members.join(", ")}
                  </p>
                  <p className="text-xs text-slate-500">{team.reason}</p>
                  <p className={`mt-1 text-xs ${v.hasViolation ? "text-rose-600" : "text-emerald-600"}`}>
                    {v.hasViolation ? `⚠️ 지정 학생과 같은 반: ${v.details}` : "✓ 지정 학생이 분리 학생들과 다른 반"}
                  </p>
                </div>
                <button onClick={() => onDelete(team.id)} className="text-slate-400 hover:text-rose-600">
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {picker && (
        <CandidatePicker
          candidates={picker.candidates}
          onPick={(name) => {
            picker.onResolved(name);
            setPicker(null);
          }}
          onCancel={() => setPicker(null)}
        />
      )}
    </div>
  );
}

export default function SeparationModal({ open, onClose, classData, groups, onAddGroup, onDeleteGroup, teams, onAddTeam, onDeleteTeam }) {
  const [tab, setTab] = useState("group");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-800">
            <AlertTriangle size={16} className="text-amber-500" /> 떨어져야 하는 학생 관리
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab("group")}
            className={`border-b-2 px-1 pb-2 text-sm font-medium ${
              tab === "group" ? "border-rose-500 text-rose-600" : "border-transparent text-slate-400"
            }`}
          >
            개별 분리 방식(A:B:C)
          </button>
          <button
            onClick={() => setTab("team")}
            className={`border-b-2 px-1 pb-2 text-sm font-medium ${
              tab === "team" ? "border-rose-500 text-rose-600" : "border-transparent text-slate-400"
            }`}
          >
            1:N 방식(A:BCD)
          </button>
        </div>

        {tab === "group" ? (
          <GroupTab classData={classData} groups={groups} onAdd={onAddGroup} onDelete={onDeleteGroup} />
        ) : (
          <TeamTab classData={classData} teams={teams} onAdd={onAddTeam} onDelete={onDeleteTeam} />
        )}
      </div>
    </div>
  );
}
