import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ChevronRight, ChevronDown, Plus, MoreVertical, ZoomIn, ZoomOut, Download,
  X, Trash2, RefreshCw, AlertTriangle, PauseCircle, XCircle, CheckCircle2,
  Clock, Diamond, Link2, Calendar, ListTree, Image as ImageIcon, Pencil,
  TrendingUp, FolderKanban
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

/* ----------------------------------------------------------------------
   Date helpers (UTC-based to avoid timezone drift)
---------------------------------------------------------------------- */
const parseDate = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const formatDate = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
};
const diffDaysDate = (a, b) => Math.round((b - a) / 86400000);
const diffDays = (a, b) => diffDaysDate(parseDate(a), parseDate(b));
const todayStr = formatDate(new Date(Date.UTC(
  new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
)));
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtHuman = (s) => {
  const d = parseDate(s);
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const fmtInput = (s) => s; // yyyy-mm-dd already matches <input type=date>
const addDaysToDate = (d, n) => { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r; };
const fmtShort = (s) => {
  const d = parseDate(s);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTH_ABBR[d.getUTCMonth()]}`;
};

/* ----------------------------------------------------------------------
   Constants
---------------------------------------------------------------------- */
const ROW_H = 36;
const MONTH_ROW_H = 28;
const DAY_ROW_H = 22;
const HEADER_H = MONTH_ROW_H + DAY_ROW_H;
const LEFT_W = 280;
const BAR_H = 22;
const MIN_DAY_W = 8;
const MAX_DAY_W = 64;

const PALETTE = ["#2F6FED","#0EA5A4","#D97706","#DC2626","#7C3AED","#0891B2","#65A30D","#DB2777","#475569"];

const STATE_META = {
  inprogress: { label: "In Progress", color: "#0EA5A4", Icon: RefreshCw, spin: true },
  delayed:    { label: "Delayed",     color: "#D97706", Icon: Clock,     spin: false },
  problem:    { label: "Problem",     color: "#DC2626", Icon: AlertTriangle, spin: false },
  pause:      { label: "Paused",      color: "#94A3B8", Icon: PauseCircle,  spin: false },
  cancelled:  { label: "Cancelled",   color: "#64748B", Icon: XCircle,   spin: false },
  completed:  { label: "Completed",   color: "#16A34A", Icon: CheckCircle2, spin: false },
};
const STATE_KEYS = Object.keys(STATE_META);

/* ----------------------------------------------------------------------
   Seed data
---------------------------------------------------------------------- */
const seedTasks = () => ([
  { id: "t1",  parentId: null, name: "Kickoff & Planning", type: "task", start: "2026-09-01", duration: 5,  progress: 100, state: "completed", color: PALETTE[0], collapsed: false, dependsOn: [] },
  { id: "t1a", parentId: "t1", name: "Requirements gathering", type: "task", start: "2026-09-01", duration: 3, progress: 100, state: "completed", color: PALETTE[0], collapsed: false, dependsOn: [] },
  { id: "t1b", parentId: "t1", name: "Scope sign-off", type: "milestone", start: "2026-09-05", duration: 0, progress: 100, state: "completed", color: PALETTE[0], collapsed: false, dependsOn: ["t1a"] },

  { id: "t2",  parentId: null, name: "Design", type: "task", start: "2026-09-06", duration: 12, progress: 55, state: "inprogress", color: PALETTE[4], collapsed: false, dependsOn: ["t1"] },
  { id: "t2a", parentId: "t2", name: "Wireframes", type: "task", start: "2026-09-06", duration: 4, progress: 100, state: "completed", color: PALETTE[4], collapsed: false, dependsOn: [] },
  { id: "t2b", parentId: "t2", name: "Visual design", type: "task", start: "2026-09-10", duration: 6, progress: 40, state: "inprogress", color: PALETTE[4], collapsed: false, dependsOn: ["t2a"] },
  { id: "t2c", parentId: "t2", name: "Design review", type: "milestone", start: "2026-09-18", duration: 0, progress: 0, state: "inprogress", color: PALETTE[4], collapsed: false, dependsOn: ["t2b"] },

  { id: "t3",  parentId: null, name: "Development", type: "task", start: "2026-09-14", duration: 22, progress: 30, state: "inprogress", color: PALETTE[2], collapsed: false, dependsOn: ["t2a"] },
  { id: "t3a", parentId: "t3", name: "Frontend build", type: "task", start: "2026-09-14", duration: 14, progress: 45, state: "inprogress", color: PALETTE[2], collapsed: false, dependsOn: [] },
  { id: "t3b", parentId: "t3", name: "Backend integration", type: "task", start: "2026-09-24", duration: 12, progress: 10, state: "delayed", color: PALETTE[2], collapsed: false, dependsOn: ["t3a"] },

  { id: "t4",  parentId: null, name: "QA & Testing", type: "task", start: "2026-10-06", duration: 9, progress: 0, state: "pause", color: PALETTE[3], collapsed: false, dependsOn: ["t3"] },
  { id: "t5",  parentId: null, name: "Launch", type: "milestone", start: "2026-10-15", duration: 0, progress: 0, state: "inprogress", color: PALETTE[0], collapsed: false, dependsOn: ["t4"] },
]);

/* ----------------------------------------------------------------------
   Tree helpers
---------------------------------------------------------------------- */
function flattenVisible(tasks) {
  const byParent = {};
  tasks.forEach((t) => {
    (byParent[t.parentId] = byParent[t.parentId] || []).push(t);
  });
  const out = [];
  const walk = (parentId, depth) => {
    (byParent[parentId] || []).forEach((t) => {
      out.push({ ...t, depth, hasChildren: !!byParent[t.id] });
      if (!t.collapsed) walk(t.id, depth + 1);
    });
  };
  walk(null, 0);
  return out;
}

function descendantIds(tasks, id) {
  const kids = tasks.filter((t) => t.parentId === id).map((t) => t.id);
  return kids.reduce((acc, k) => acc.concat(k, descendantIds(tasks, k)), []);
}

/* Keep a summary (parent) task's own Start/Duration in sync with the union of its
   immediate children's spans, walking upward so grandparents etc. stay consistent too.
   Only walks the ancestor chain of `startId`, since every other branch is assumed
   already consistent (parents are never edited directly — see DetailModal/beginDrag). */
function rollupAncestors(tasks, startId) {
  const next = tasks.map((t) => ({ ...t }));
  const byId = Object.fromEntries(next.map((t) => [t.id, t]));
  let parentId = byId[startId]?.parentId;
  while (parentId && byId[parentId]) {
    const kids = next.filter((t) => t.parentId === parentId);
    if (!kids.length) break;
    let minS = null, maxE = null;
    kids.forEach((k) => {
      const s = parseDate(k.start);
      const e = k.type === "milestone" ? s : parseDate(addDays(k.start, Math.max(k.duration, 1) - 1));
      if (!minS || s < minS) minS = s;
      if (!maxE || e > maxE) maxE = e;
    });
    const parent = byId[parentId];
    parent.start = formatDate(minS);
    parent.duration = parent.type === "milestone" ? 0 : Math.max(1, diffDaysDate(minS, maxE) + 1);
    parentId = parent.parentId;
  }
  return next;
}

function ancestorsReachable(tasks, fromId) {
  // ids reachable by walking predecessor edges upward from fromId (i.e. fromId depends on them, transitively)
  const map = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const seen = new Set();
  const stack = [...(map[fromId]?.dependsOn || [])];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(map[id]?.dependsOn || []));
  }
  return seen;
}

/* ---- Critical Path (CPM) ----
   Forward/backward pass over the dependency graph (dependsOn edges),
   anchored to each task's own scheduled start so results reflect the
   plan as currently laid out on the Gantt, not a re-optimized schedule. */
function computeCriticalPath(tasks) {
  const ids = tasks.map((t) => t.id);
  if (!ids.length) return { criticalIds: new Set(), criticalEdges: new Set(), slack: {} };
  const map = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const succ = {}; ids.forEach((id) => (succ[id] = []));
  ids.forEach((id) => (map[id].dependsOn || []).forEach((p) => { if (succ[p]) succ[p].push(id); }));

  const indeg = {}; ids.forEach((id) => (indeg[id] = (map[id].dependsOn || []).filter((p) => map[p]).length));
  const queue = ids.filter((id) => indeg[id] === 0);
  const order = [];
  const indegCopy = { ...indeg };
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (succ[id] || []).forEach((s) => { indegCopy[s] -= 1; if (indegCopy[s] === 0) queue.push(s); });
  }
  ids.forEach((id) => { if (!order.includes(id)) order.push(id); }); // cycle fallback

  let epoch = null;
  tasks.forEach((t) => { const s = parseDate(t.start); if (!epoch || s < epoch) epoch = s; });
  const dayIdx = (dateStr) => diffDaysDate(epoch, parseDate(dateStr));
  const dur = (t) => (t.type === "milestone" ? 0 : Math.max(t.duration, 1));

  const ES = {}, EF = {};
  order.forEach((id) => {
    const t = map[id];
    const preds = (t.dependsOn || []).filter((p) => map[p]);
    const base = dayIdx(t.start);
    const es = preds.length ? Math.max(base, ...preds.map((p) => EF[p] + 1)) : base;
    ES[id] = es;
    EF[id] = t.type === "milestone" ? es : es + dur(t) - 1;
  });

  const projectEnd = Math.max(...ids.map((id) => EF[id]));

  const LS = {}, LF = {};
  [...order].reverse().forEach((id) => {
    const t = map[id];
    const succs = succ[id] || [];
    const lf = succs.length ? Math.min(...succs.map((s) => LS[s] - 1)) : projectEnd;
    LF[id] = lf;
    LS[id] = t.type === "milestone" ? lf : lf - dur(t) + 1;
  });

  const slack = {}; const criticalIds = new Set();
  ids.forEach((id) => { slack[id] = LS[id] - ES[id]; if (slack[id] <= 0) criticalIds.add(id); });

  const criticalEdges = new Set();
  ids.forEach((id) => {
    (map[id].dependsOn || []).forEach((p) => {
      if (map[p] && criticalIds.has(id) && criticalIds.has(p) && EF[p] + 1 === ES[id]) {
        criticalEdges.add(`${p}->${id}`);
      }
    });
  });

  return { criticalIds, criticalEdges, slack };
}

/* ---- S-Curve data (Planned vs Actual vs Forecast) ---- */
function computeSCurve(tasks, bounds, todayIso) {
  const leaves = tasks.filter((t) => t.type === "task" && !tasks.some((x) => x.parentId === t.id));
  const totalWeight = leaves.reduce((sum, t) => sum + Math.max(t.duration, 1), 0) || 1;
  const totalDays = diffDaysDate(bounds.start, bounds.end) + 1;
  const endIdx = Math.max(0, totalDays - 1);
  const todayIdxRaw = diffDaysDate(bounds.start, parseDate(todayIso));
  const todayIdx = Math.max(0, Math.min(endIdx, todayIdxRaw));
  const step = Math.max(1, Math.ceil(totalDays / 150));

  const points = [];
  for (let i = 0; i <= endIdx; i += step) {
    let planned = 0, actual = 0;
    leaves.forEach((t) => {
      const w = Math.max(t.duration, 1);
      const s = diffDaysDate(bounds.start, parseDate(t.start));
      const plannedFrac = Math.max(0, Math.min(1, (i - s + 1) / w));
      planned += w * plannedFrac;
      const actualFrac = Math.max(0, Math.min(1, (Math.min(i, todayIdx) - s + 1) / w)) * (t.progress / 100);
      actual += w * actualFrac;
    });
    const plannedPct = Math.round((planned / totalWeight) * 1000) / 10;
    const actualPct = i <= todayIdx ? Math.round((actual / totalWeight) * 1000) / 10 : null;
    points.push({ idx: i, date: formatDate(addDaysToDate(bounds.start, i)), planned: plannedPct, actual: actualPct });
  }
  if (points.length && points[points.length - 1].idx !== endIdx) {
    let planned = 0, actual = 0;
    leaves.forEach((t) => {
      const w = Math.max(t.duration, 1);
      const s = diffDaysDate(bounds.start, parseDate(t.start));
      planned += w * Math.max(0, Math.min(1, (endIdx - s + 1) / w));
      const af = Math.max(0, Math.min(1, (Math.min(endIdx, todayIdx) - s + 1) / w)) * (t.progress / 100);
      actual += w * af;
    });
    points.push({
      idx: endIdx, date: formatDate(addDaysToDate(bounds.start, endIdx)),
      planned: Math.round((planned / totalWeight) * 1000) / 10,
      actual: endIdx <= todayIdx ? Math.round((actual / totalWeight) * 1000) / 10 : null,
    });
  }

  let todayActual = 0;
  points.forEach((p) => { if (p.idx <= todayIdx && p.actual != null) todayActual = p.actual; });

  points.forEach((p) => {
    if (p.idx >= todayIdx) {
      const frac = endIdx > todayIdx ? Math.max(0, Math.min(1, (p.idx - todayIdx) / (endIdx - todayIdx))) : 1;
      p.forecast = Math.round((todayActual + (100 - todayActual) * frac) * 10) / 10;
    } else {
      p.forecast = null;
    }
  });

  return points;
}


function getBounds(tasks) {
  let min = null, max = null;
  tasks.forEach((t) => {
    const s = parseDate(t.start);
    const e = t.type === "milestone" ? s : parseDate(addDays(t.start, Math.max(t.duration, 1) - 1));
    if (!min || s < min) min = s;
    if (!max || e > max) max = e;
  });
  if (!min) { min = parseDate(todayStr); max = parseDate(addDays(todayStr, 30)); }
  min = new Date(min); min.setUTCDate(min.getUTCDate() - 3);
  max = new Date(max); max.setUTCDate(max.getUTCDate() + 6);
  const start = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1));
  const end = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth() + 1, 0));
  return { start, end };
}

function monthSegments(start, end, dayWidth) {
  const segs = [];
  let cursor = new Date(start);
  while (cursor <= end) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const segEnd = monthEnd < end ? monthEnd : end;
    const days = diffDaysDate(cursor, segEnd) + 1;
    segs.push({
      key: `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`,
      label: `${MONTH_ABBR[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
      width: days * dayWidth,
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return segs;
}

function dayCells(start, end, dayWidth) {
  const cells = [];
  let cursor = new Date(start);
  let i = 0;
  while (cursor <= end) {
    const dow = cursor.getUTCDay();
    cells.push({
      key: formatDate(cursor),
      x: i * dayWidth,
      label: cursor.getUTCDate(),
      isWeekend: dow === 0 || dow === 6,
      isMonthStart: cursor.getUTCDate() === 1,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    i += 1;
  }
  return cells;
}

let uidCounter = 1;
const newId = () => `n${Date.now()}${uidCounter++}`;

const starterTasks = () => {
  const id = newId();
  return [
    { id, parentId: null, name: "Project kickoff", type: "task", start: todayStr, duration: 5, progress: 0, state: "inprogress", color: PALETTE[0], collapsed: false, dependsOn: [] },
  ];
};


/* ----------------------------------------------------------------------
   Small UI atoms
---------------------------------------------------------------------- */
function IconBtn({ onClick, title, children, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-8 w-8 flex items-center justify-center rounded-md border transition-colors
        ${active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}

function StateBadge({ state, size = 13 }) {
  const meta = STATE_META[state] || STATE_META.inprogress;
  const { Icon } = meta;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: size + 6, height: size + 6, background: "rgba(255,255,255,0.25)" }}
      title={meta.label}
    >
      <Icon size={size} color="#fff" className={meta.spin ? "animate-spin-slow" : ""} />
    </span>
  );
}

/* ----------------------------------------------------------------------
   Row context menu
---------------------------------------------------------------------- */
function RowMenu({ x, y, onClose, onAddTask, onAddMilestone, onEdit, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: x, top: y, zIndex: 40 }}
      className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm"
    >
      <button onClick={onEdit} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2">
        <ListTree size={14} /> Edit details
      </button>
      <button onClick={onAddTask} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2">
        <Plus size={14} /> Add subtask
      </button>
      <button onClick={onAddMilestone} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2">
        <Diamond size={14} /> Add milestone
      </button>
      <div className="h-px bg-slate-100 my-1" />
      <button onClick={onDelete} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2">
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
}

function DepMenu({ x, y, onClose, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: x, top: y, zIndex: 40, minWidth: 190 }}
      className="bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm"
    >
      <button onClick={onDelete} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700">
        <Trash2 size={15} className="text-slate-500" /> Delete dependency
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------------
   Project switcher popover (multi-project support)
---------------------------------------------------------------------- */
function ProjectSwitcher({ projects, currentId, anchorRect, onSelect, onRename, onDelete, onCreate, onClose }) {
  const ref = useRef(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [onClose]);

  const commitRename = (id) => {
    onRename(id, (renameVal || "").trim() || projects.find((p) => p.id === id)?.name || "Untitled project");
    setRenamingId(null);
  };
  const commitCreate = () => {
    if (newName.trim()) { onCreate(newName.trim()); setCreating(false); setNewName(""); }
  };

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: anchorRect.left, top: anchorRect.bottom + 6, zIndex: 50, width: 280 }}
      className="bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 text-sm"
    >
      <div className="px-3 pb-1.5 text-xs font-medium text-slate-400 tracking-wide">PROJECTS</div>
      <div className="max-h-56 overflow-auto">
        {projects.map((p) => (
          <div key={p.id} className={`flex items-center gap-1.5 px-2 py-1 mx-1 rounded-md ${p.id === currentId ? "bg-slate-100" : "hover:bg-slate-50"}`}>
            {renamingId === p.id ? (
              <input
                autoFocus
                className="flex-1 border border-slate-300 rounded px-1.5 py-0.5 text-sm min-w-0"
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(p.id); if (e.key === "Escape") setRenamingId(null); }}
                onBlur={() => commitRename(p.id)}
              />
            ) : (
              <button
                className="flex-1 min-w-0 text-left truncate text-slate-700 py-1 flex items-center gap-1.5"
                onClick={() => { onSelect(p.id); onClose(); }}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.id === currentId ? "bg-slate-900" : "bg-transparent"}`} />
                <span className="truncate">{p.name}</span>
              </button>
            )}
            <button
              onClick={() => { setRenamingId(p.id); setRenameVal(p.name); }}
              className="h-6 w-6 shrink-0 flex items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100"
              title="Rename project"
            >
              <Pencil size={12} />
            </button>
            {projects.length > 1 && (
              <button
                onClick={() => onDelete(p.id)}
                className="h-6 w-6 shrink-0 flex items-center justify-center rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
                title="Delete project"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="h-px bg-slate-100 my-1.5" />
      {creating ? (
        <div className="px-2 flex items-center gap-1.5">
          <input
            autoFocus
            placeholder="Project name"
            className="flex-1 border border-slate-300 rounded px-1.5 py-1 text-sm min-w-0"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitCreate(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }}
          />
          <button onClick={commitCreate} className="h-7 px-2.5 rounded-md bg-slate-900 text-white text-xs shrink-0">Add</button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700">
          <Plus size={14} /> New project
        </button>
      )}
    </div>
  );
}


/* ----------------------------------------------------------------------
   Task Detail Panel (modal) — mirrors detailtask.png
---------------------------------------------------------------------- */
function DetailModal({ task, hasChildren, onSave, onDelete, onClose }) {
  const [tab, setTab] = useState("General");
  const [draft, setDraft] = useState(task);
  useEffect(() => setDraft(task), [task]);
  if (!task) return null;

  const isMilestone = draft.type === "milestone";
  const end = isMilestone ? draft.start : addDays(draft.start, Math.max(draft.duration, 1) - 1);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const onStartChange = (v) => update({ start: v });
  const onDaysChange = (v) => {
    const n = Math.max(1, parseInt(v || "1", 10));
    update({ duration: n });
  };
  const onEndChange = (v) => {
    const n = Math.max(1, diffDays(draft.start, v) + 1);
    update({ duration: n });
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: "rgba(15,23,42,0.45)", zIndex: 50 }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        style={{ width: 560, maxWidth: "92vw" }}
      >
        <div className="flex items-center border-b border-slate-200 px-2">
          {["General", "Description", "Resources", "Attachment"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"}`}
            >
              {t}
            </button>
          ))}
          <button onClick={onClose} className="ml-auto mr-1 h-8 w-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {tab === "General" && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
                  <div className="relative">
                    <div
                      className="h-10 w-10 rounded-md border border-slate-300 cursor-pointer"
                      style={{ background: draft.color }}
                      onClick={() => update({ __pickerOpen: !draft.__pickerOpen })}
                    />
                    {draft.__pickerOpen && (
                      <div className="absolute z-10 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg grid grid-cols-5 gap-1">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            className="h-6 w-6 rounded"
                            style={{ background: c }}
                            onClick={() => update({ color: c, __pickerOpen: false })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
                  <input
                    className="w-full border border-slate-300 rounded-md px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                    value={draft.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </div>
                <div className="w-36">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                  <select
                    className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    value={draft.type}
                    disabled={hasChildren}
                    onChange={(e) => update({ type: e.target.value, duration: e.target.value === "milestone" ? 0 : Math.max(1, draft.duration) })}
                  >
                    <option value="task">Task</option>
                    <option value="milestone">Milestone</option>
                  </select>
                </div>
              </div>

              {hasChildren && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  This is a summary task — its Start Date, Days and End Date are calculated automatically from its subtasks. Edit the subtasks to change them, or drag this bar on the Gantt to move the whole group together.
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    disabled={hasChildren}
                    className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    value={draft.start}
                    onChange={(e) => onStartChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Days</label>
                  <input
                    type="number"
                    min={isMilestone ? 0 : 1}
                    disabled={isMilestone || hasChildren}
                    className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    value={isMilestone ? 0 : draft.duration}
                    onChange={(e) => onDaysChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
                  <input
                    type="date"
                    disabled={isMilestone || hasChildren}
                    className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                    value={end}
                    onChange={(e) => onEndChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">State Icon</label>
                  <select
                    className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm bg-white"
                    value={draft.state}
                    onChange={(e) => update({ state: e.target.value })}
                  >
                    {STATE_KEYS.map((k) => (
                      <option key={k} value={k}>{STATE_META[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Progress</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={100}
                      className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm"
                      value={draft.progress}
                      onChange={(e) => update({ progress: Math.min(100, Math.max(0, parseInt(e.target.value || "0", 10))) })}
                    />
                    <span className="text-sm text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === "Description" && (
            <textarea
              className="w-full h-40 border border-slate-300 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Add a description for this item…"
              value={draft.description || ""}
              onChange={(e) => update({ description: e.target.value })}
            />
          )}
          {tab === "Resources" && (
            <div className="text-sm text-slate-400 h-40 flex items-center justify-center border border-dashed border-slate-200 rounded-md">
              No resources assigned yet.
            </div>
          )}
          {tab === "Attachment" && (
            <div className="text-sm text-slate-400 h-40 flex items-center justify-center border border-dashed border-slate-200 rounded-md">
              Drag files here to attach.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button
            onClick={() => onDelete(task.id)}
            className="mr-auto h-9 px-3 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-sm"
          >
            <Trash2 size={14} /> Delete
          </button>
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="h-9 px-4 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------
   Export Modal — mirrors export.png, generates PNG mirroring projectplan_export.png
---------------------------------------------------------------------- */
function ExportModal({ tasks, projectName, bounds, onClose }) {
  const [title, setTitle] = useState(projectName);
  const [start, setStart] = useState(formatDate(bounds.start));
  const [end, setEnd] = useState(formatDate(bounds.end));
  const [timescale, setTimescale] = useState("Months, Years");
  const [previewUrl, setPreviewUrl] = useState(null);

  const generate = () => {
    const canvas = document.createElement("canvas");
    const rows = flattenVisible(tasks);
    const dpr = 2;
    const dayW = timescale === "Days" ? 22 : timescale === "Weeks" ? 10 : 5;
    const rowH = 34;
    const leftW = 230;
    const headerH = 56;
    const padTop = 70;
    const s = parseDate(start), e = parseDate(end);
    const totalDays = Math.max(1, diffDaysDate(s, e) + 1);
    const width = leftW + totalDays * dayW + 40;
    const height = padTop + headerH + rows.length * rowH + 30;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // title
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 22px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, width / 2, 36);

    const gridTop = padTop;
    const xFor = (dateStr) => leftW + 20 + diffDaysDate(s, parseDate(dateStr)) * dayW;

    // month header
    let cursor = new Date(s);
    ctx.font = "600 12px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#e2e8f0";
    while (cursor <= e) {
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
      const segEnd = monthEnd < e ? monthEnd : e;
      const segDays = diffDaysDate(cursor, segEnd) + 1;
      const x0 = xFor(formatDate(cursor));
      const w = segDays * dayW;
      ctx.fillStyle = "#475569";
      ctx.fillText(`${MONTH_ABBR[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`, x0 + w / 2, gridTop + headerH / 2 + 4);
      ctx.beginPath(); ctx.moveTo(x0, gridTop); ctx.lineTo(x0, gridTop + headerH + rows.length * rowH); ctx.stroke();
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    ctx.beginPath();
    ctx.moveTo(leftW + 20, gridTop + headerH);
    ctx.lineTo(leftW + 20 + totalDays * dayW, gridTop + headerH);
    ctx.stroke();

    const rowY = {};
    const rowRect = {};

    // row backgrounds, labels, gridlines
    rows.forEach((t, i) => {
      const y = gridTop + headerH + i * rowH;
      rowY[t.id] = y + rowH / 2;
      ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#fafafa";
      ctx.fillRect(0, y, width, rowH);
      ctx.strokeStyle = "#f1f5f9";
      ctx.beginPath(); ctx.moveTo(0, y + rowH); ctx.lineTo(width, y + rowH); ctx.stroke();

      ctx.fillStyle = "#1e293b";
      ctx.font = t.depth === 0 ? "600 12.5px Inter, Arial, sans-serif" : "400 12px Inter, Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(t.name, 16 + t.depth * 14, y + rowH / 2 + 4, leftW - 24 - t.depth * 14);

      const barY = y + (rowH - 20) / 2;
      if (t.type === "milestone") {
        const cx = xFor(t.start);
        rowRect[t.id] = { x0: cx, x1: cx, y: rowY[t.id] };
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.moveTo(cx, barY); ctx.lineTo(cx + 9, barY + 10); ctx.lineTo(cx, barY + 20); ctx.lineTo(cx - 9, barY + 10);
        ctx.closePath(); ctx.fill();
      } else {
        const x0 = xFor(t.start);
        const w = Math.max(dayW, t.duration * dayW);
        rowRect[t.id] = { x0, x1: x0 + w, y: rowY[t.id] };
        const rad = 5;
        ctx.fillStyle = t.color;
        roundRectPath(ctx, x0, barY, w, 20, rad);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "600 11px Inter, Arial, sans-serif";
        ctx.textAlign = "center";
        if (w > 40) ctx.fillText(t.name, x0 + w / 2, barY + 14, w - 10);
      }
    });

    // dependencies
    ctx.strokeStyle = "#f59e0b";
    ctx.fillStyle = "#f59e0b";
    ctx.lineWidth = 1.4;
    rows.forEach((t) => {
      (t.dependsOn || []).forEach((pid) => {
        const p = rowRect[pid], c = rowRect[t.id];
        if (!p || !c) return;
        const pts = dependencyRoute(p, c, rowH);
        ctx.beginPath();
        pts.forEach(([px, py], i) => { if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
        ctx.stroke();
        const [tipX, tipY] = pts[pts.length - 1];
        ctx.beginPath();
        ctx.moveTo(tipX + 3, tipY);
        ctx.lineTo(tipX - 5, tipY - 4);
        ctx.lineTo(tipX - 5, tipY + 4);
        ctx.closePath();
        ctx.fill();
      });
    });

    setPreviewUrl(canvas.toDataURL("image/png"));
  };

  useEffect(() => { generate(); /* eslint-disable-next-line */ }, [title, start, end, timescale]);

  const download = () => {
    if (!previewUrl) { generate(); return; }
    try {
      const a = document.createElement("a");
      a.href = previewUrl;
      a.download = `${title.replace(/\s+/g, "_") || "project-plan"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      openInNewTab();
    }
  };

  const openInNewTab = () => {
    if (!previewUrl) { generate(); return; }
    const win = window.open();
    if (win) {
      win.document.write(`<title>${title}</title><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${previewUrl}" style="max-width:100%;height:auto;" /></body>`);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: "rgba(15,23,42,0.45)", zIndex: 50 }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col"
        style={{ width: 880, maxWidth: "95vw", maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h3 className="font-semibold text-slate-800">Export as PNG</h3>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto flex" style={{ minHeight: 0 }}>
          <div className="p-5 space-y-4 border-r border-slate-200 shrink-0" style={{ width: 280 }}>
            <p className="text-sm text-slate-500 -mt-1">Export the current plan as a PNG for printing or sharing.</p>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
              <input className="w-full border border-slate-300 rounded-md px-3 h-10 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Timescale</label>
              <select className="w-full border border-slate-300 rounded-md px-2 h-10 text-sm bg-white" value={timescale} onChange={(e) => setTimescale(e.target.value)}>
                <option>Days</option>
                <option>Weeks</option>
                <option>Months, Years</option>
              </select>
            </div>
            <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              If the Download button doesn't start a save automatically, right-click (or long-press) the preview image and choose "Save image as…", or use "Open in new tab" and save from there.
            </div>
          </div>
          <div className="flex-1 p-5 bg-slate-100 flex items-center justify-center overflow-auto">
            {previewUrl ? (
              <img src={previewUrl} alt="Gantt chart export preview" style={{ maxWidth: "100%", height: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }} />
            ) : (
              <span className="text-sm text-slate-400">Generating preview…</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 shrink-0">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">Cancel</button>
          <button onClick={openInNewTab} className="h-9 px-4 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">Open in new tab</button>
          <button onClick={download} className="h-9 px-4 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center gap-1.5">
            <Download size={14} /> Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}

function dependencyRoute(p, c, rowH) {
  // p = {x1, y} predecessor's connection-out point; c = {x0, y} successor's connection-in point.
  // Always approaches c.x0 moving left-to-right, so the arrowhead enters the Start edge from the front,
  // even when the predecessor's finish and the successor's start are close together or overlapping.
  const OUT = 10, IN = 12;
  const xOut = p.x1 + OUT;
  const xIn = c.x0 - IN;
  const endX = c.x0 - 3;
  if (xOut <= xIn) {
    return [[p.x1, p.y], [xOut, p.y], [xOut, c.y], [endX, c.y]];
  }
  const loopY = p.y + (c.y >= p.y ? 1 : -1) * (rowH / 2);
  return [[p.x1, p.y], [xOut, p.y], [xOut, loopY], [xIn, loopY], [xIn, c.y], [endX, c.y]];
}
function routeToSvgPath(pts) {
  return pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ----------------------------------------------------------------------
   S-Curve Modal — Planned vs Actual vs Forecast
---------------------------------------------------------------------- */
function SCurveTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-lg px-3 py-2 text-xs">
      <div className="font-medium text-slate-700 mb-1">{fmtHuman(label)}</div>
      {payload.map((p) => (
        p.value != null && (
          <div key={p.dataKey} className="flex items-center gap-1.5" style={{ color: p.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}: {p.value}%
          </div>
        )
      ))}
    </div>
  );
}

function SCurveModal({ tasks, bounds, todayIso, onClose }) {
  const data = useMemo(() => computeSCurve(tasks, bounds, todayIso), [tasks, bounds, todayIso]);
  const todayActual = useMemo(() => {
    let v = 0;
    data.forEach((p) => { if (p.actual != null) v = p.actual; });
    return v;
  }, [data]);

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(15,23,42,0.45)", zIndex: 50 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl border border-slate-200" style={{ width: 780, maxWidth: "95vw" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-800">S-Curve — Progress Tracking</h3>
            <p className="text-xs text-slate-400 mt-0.5">Cumulative work completed over time, weighted by task duration.</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4 mb-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#2F6FED" }} /> Planned</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#16A34A" }} /> Actual (as of today: {todayActual}%)</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#D97706" }} /> Forecast</span>
          </div>
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 6, right: 24, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={fmtShort} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<SCurveTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="planned" name="Planned" stroke="#2F6FED" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke="#16A34A" strokeWidth={2.2} dot={false} connectNulls={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#D97706" strokeWidth={2.2} strokeDasharray="6 4" dot={false} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Planned follows the scheduled baseline for every task. Actual reflects logged progress up to today, ramped across each task's elapsed span.
            Forecast draws a straight line from today's actual completion to 100% by the project's current end date.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="h-9 px-4 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------
   Main App
---------------------------------------------------------------------- */
export default function ProjectGanttApp() {
  const [projects, setProjects] = useState(() => [
    { id: "proj1", name: "Website Redesign Launch", tasks: seedTasks() },
  ]);
  const [currentProjectId, setCurrentProjectId] = useState("proj1");
  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];
  const tasks = currentProject.tasks;
  const setTasks = useCallback((updater) => {
    setProjects((ps) => ps.map((p) => (
      p.id === currentProject.id ? { ...p, tasks: typeof updater === "function" ? updater(p.tasks) : updater } : p
    )));
    // eslint-disable-next-line
  }, [currentProject.id]);

  const [dayWidth, setDayWidth] = useState(26);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [menu, setMenu] = useState(null); // {id, x, y}
  const [depMenu, setDepMenu] = useState(null); // {predId, taskId, x, y}
  const [exportOpen, setExportOpen] = useState(false);
  const [sCurveOpen, setSCurveOpen] = useState(false);
  const [projSwitcherOpen, setProjSwitcherOpen] = useState(false);
  const [highlightCritical, setHighlightCritical] = useState(false);
  const [dragInfo, setDragInfo] = useState(null);
  const [connectPreview, setConnectPreview] = useState(null);

  const wrapperRef = useRef(null);
  const scrollRef = useRef(null);
  const projBtnRef = useRef(null);

  const rows = useMemo(() => flattenVisible(tasks), [tasks]);
  const bounds = useMemo(() => getBounds(tasks), [tasks]);
  const criticalInfo = useMemo(() => computeCriticalPath(tasks), [tasks]);
  const totalDays = diffDaysDate(bounds.start, bounds.end) + 1;
  const contentWidth = totalDays * dayWidth;
  const segments = useMemo(() => monthSegments(bounds.start, bounds.end, dayWidth), [bounds, dayWidth]);
  const days = useMemo(() => dayCells(bounds.start, bounds.end, dayWidth), [bounds, dayWidth]);
  const weekendDays = useMemo(() => days.filter((d) => d.isWeekend), [days]);
  const showDayLabels = dayWidth >= 16;

  const xFor = useCallback((dateStr) => diffDaysDate(bounds.start, parseDate(dateStr)) * dayWidth, [bounds, dayWidth]);
  const dayIdxFromClientX = useCallback((clientX) => {
    const rect = wrapperRef.current.getBoundingClientRect();
    return Math.round((clientX - rect.left - LEFT_W) / dayWidth);
  }, [dayWidth]);
  const relCoordsFromClient = useCallback((clientX, clientY) => {
    const rect = wrapperRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const todayX = xFor(todayStr);
  const showToday = todayX >= 0 && todayX <= contentWidth;

  /* ---------------- CRUD ---------------- */
  const updateTask = (id, patch) => setTasks((ts) => {
    const next = ts.map((t) => (t.id === id ? { ...t, ...patch } : t));
    return rollupAncestors(next, id);
  });
  const saveDetail = (draft) => {
    const clean = { ...draft }; delete clean.__pickerOpen; delete clean.depth; delete clean.hasChildren;
    const hasKids = tasks.some((x) => x.parentId === clean.id);
    if (hasKids) {
      // Summary tasks' dates are derived from their subtasks — never overwrite them directly.
      const original = tasks.find((t) => t.id === clean.id);
      if (original) { clean.start = original.start; clean.duration = original.duration; }
    }
    setTasks((ts) => {
      const next = ts.map((t) => (t.id === clean.id ? { ...t, ...clean } : t));
      return rollupAncestors(next, clean.id);
    });
    setDetailTaskId(null);
  };
  const deleteTask = (id) => {
    const toRemove = new Set([id, ...descendantIds(tasks, id)]);
    const parentId = tasks.find((t) => t.id === id)?.parentId;
    setTasks((ts) => {
      const next = ts.filter((t) => !toRemove.has(t.id)).map((t) => ({ ...t, dependsOn: (t.dependsOn || []).filter((d) => !toRemove.has(d)) }));
      return parentId ? rollupAncestors(next, parentId) : next;
    });
    setDetailTaskId(null);
    setMenu(null);
  };
  const deleteDependency = (predId, taskId) => {
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, dependsOn: (t.dependsOn || []).filter((d) => d !== predId) } : t)));
    setDepMenu(null);
  };
  const addChild = (parentId, type) => {
    const parent = tasks.find((t) => t.id === parentId);
    const id = newId();
    const start = parent ? parent.start : todayStr;
    const t = {
      id, parentId: parentId || null,
      name: type === "milestone" ? "New milestone" : "New task",
      type, start, duration: type === "milestone" ? 0 : 3,
      progress: 0, state: "inprogress", color: parent ? parent.color : PALETTE[0],
      collapsed: false, dependsOn: [],
    };
    setTasks((ts) => {
      const next = [...ts, t];
      return parentId ? rollupAncestors(next, parentId) : next;
    });
    setMenu(null);
    setDetailTaskId(id);
  };
  const addTopLevel = (type) => addChild(null, type);
  const toggleCollapse = (id) => updateTask(id, { collapsed: !tasks.find((t) => t.id === id).collapsed });

  /* ---------------- Project management ---------------- */
  const selectProject = (id) => setCurrentProjectId(id);
  const renameProject = (id, name) => setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
  const deleteProject = (id) => {
    setProjects((ps) => {
      if (ps.length <= 1) return ps;
      const filtered = ps.filter((p) => p.id !== id);
      if (currentProjectId === id) setCurrentProjectId(filtered[0].id);
      return filtered;
    });
  };
  const createProject = (name) => {
    const id = newId();
    setProjects((ps) => [...ps, { id, name, tasks: starterTasks() }]);
    setCurrentProjectId(id);
  };

  /* ---------------- Drag: move / resize ----------------
     Summary (parent) tasks can only be moved as a whole — moving one shifts its entire
     subtree by the same amount, keeping it consistent with its children automatically.
     They can't be resized directly since their span is always derived from their children. */
  const beginDrag = (e, task, type) => {
    e.preventDefault(); e.stopPropagation();
    if (type !== "move" && task.hasChildren) return;
    const isParent = type === "move" && task.hasChildren;
    const subtreeIds = isParent ? [task.id, ...descendantIds(tasks, task.id)] : [task.id];
    const originalStarts = {};
    subtreeIds.forEach((id) => { const tk = tasks.find((x) => x.id === id); if (tk) originalStarts[id] = tk.start; });
    setDragInfo({
      type, taskId: task.id, startDayIdx: dayIdxFromClientX(e.clientX),
      originalStart: task.start, originalDuration: task.duration,
      isParent, subtreeIds, originalStarts,
    });
  };

  const beginConnect = (e, task) => {
    e.preventDefault(); e.stopPropagation();
    const { x, y } = relCoordsFromClient(e.clientX, e.clientY);
    setConnectPreview({ fromId: task.id, x1: x, y1: y, x2: x, y2: y });
  };

  useEffect(() => {
    if (!dragInfo) return;
    const onMove = (e) => {
      const dayIdx = dayIdxFromClientX(e.clientX);
      const delta = dayIdx - dragInfo.startDayIdx;
      if (dragInfo.isParent) {
        setTasks((ts) => {
          const shifted = ts.map((t) => (
            dragInfo.subtreeIds.includes(t.id) ? { ...t, start: addDays(dragInfo.originalStarts[t.id], delta) } : t
          ));
          return rollupAncestors(shifted, dragInfo.taskId);
        });
        return;
      }
      const task = tasks.find((t) => t.id === dragInfo.taskId);
      if (!task) return;
      if (dragInfo.type === "move") {
        updateTask(task.id, { start: addDays(dragInfo.originalStart, delta) });
      } else if (dragInfo.type === "right") {
        updateTask(task.id, { duration: Math.max(1, dragInfo.originalDuration + delta) });
      } else if (dragInfo.type === "left") {
        const newDur = Math.max(1, dragInfo.originalDuration - delta);
        const usedDelta = dragInfo.originalDuration - newDur;
        updateTask(task.id, { start: addDays(dragInfo.originalStart, usedDelta), duration: newDur });
      }
    };
    const onUp = () => setDragInfo(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    // eslint-disable-next-line
  }, [dragInfo, dayWidth]);

  useEffect(() => {
    if (!connectPreview) return;
    const onMove = (e) => {
      const { x, y } = relCoordsFromClient(e.clientX, e.clientY);
      setConnectPreview((p) => (p ? { ...p, x2: x, y2: y } : p));
    };
    const onUp = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const rowEl = el && el.closest ? el.closest("[data-task-row]") : null;
      const toId = rowEl ? rowEl.getAttribute("data-task-row") : null;
      setConnectPreview((p) => {
        if (p && toId && toId !== p.fromId) {
          const reachable = ancestorsReachable(tasks, p.fromId);
          const targetTask = tasks.find((t) => t.id === toId);
          const already = targetTask && (targetTask.dependsOn || []).includes(p.fromId);
          if (!reachable.has(toId) && !already) {
            updateTask(toId, { dependsOn: [...(targetTask.dependsOn || []), p.fromId] });
          }
        }
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    // eslint-disable-next-line
  }, [connectPreview, tasks]);

  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) : null;
  const detailHasChildren = detailTask ? tasks.some((x) => x.parentId === detailTask.id) : false;

  /* ---------------- Dependency geometry for SVG overlay ---------------- */
  const rowIndexOf = useMemo(() => Object.fromEntries(rows.map((r, i) => [r.id, i])), [rows]);
  const pointFor = (t) => {
    const y = rowIndexOf[t.id] * ROW_H + ROW_H / 2;
    if (t.type === "milestone") { const x = xFor(t.start); return { x0: x, x1: x, y }; }
    const x0 = xFor(t.start); const x1 = x0 + Math.max(dayWidth, t.duration * dayWidth);
    return { x0, x1, y };
  };

  return (
    <div className="w-full h-screen flex flex-col bg-slate-50 text-slate-800" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        .animate-spin-slow { animation: spin-slow 2.2s linear infinite; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; }
      `}</style>

      {/* Top bar */}
      <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-slate-200 bg-white">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 via-red-500 to-emerald-500 flex items-center justify-center shrink-0">
          <FolderKanban size={16} className="text-white" />
        </div>
        <button
          ref={projBtnRef}
          onClick={() => setProjSwitcherOpen((v) => !v)}
          className="font-semibold text-slate-800 hover:bg-slate-50 rounded-md pl-1.5 pr-1 py-1 -ml-1 flex items-center gap-1"
          style={{ fontSize: 15, maxWidth: 260 }}
        >
          <span className="truncate">{currentProject.name}</span>
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        </button>
        <span className="text-xs text-slate-400 border border-slate-200 rounded-full px-2 py-0.5 shrink-0">Gantt</span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-sm text-slate-600 select-none cursor-pointer px-1 shrink-0">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-red-500"
            checked={highlightCritical}
            onChange={(e) => setHighlightCritical(e.target.checked)}
          />
          Highlight critical path
        </label>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button onClick={() => addTopLevel("task")} className="h-8 px-3 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
          <Plus size={14} /> Task
        </button>
        <button onClick={() => addTopLevel("milestone")} className="h-8 px-3 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
          <Diamond size={13} /> Milestone
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <IconBtn title="Zoom out" onClick={() => setDayWidth((w) => Math.max(MIN_DAY_W, Math.round(w / 1.25)))}><ZoomOut size={15} /></IconBtn>
        <IconBtn title="Zoom in" onClick={() => setDayWidth((w) => Math.min(MAX_DAY_W, Math.round(w * 1.25)))}><ZoomIn size={15} /></IconBtn>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button onClick={() => setSCurveOpen(true)} className="h-8 px-3 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
          <TrendingUp size={14} /> S-Curve
        </button>
        <button onClick={() => setExportOpen(true)} className="h-8 px-3 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 flex items-center gap-1.5">
          <Download size={14} /> Export
        </button>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative select-none">
        <div ref={wrapperRef} style={{ width: LEFT_W + contentWidth, position: "relative" }}>
          {/* Header */}
          <div className="sticky top-0 z-30 bg-white">
            <div className="flex" style={{ height: MONTH_ROW_H }}>
              <div className="sticky left-0 z-30 bg-white border-r border-b border-slate-200 flex items-center px-3 text-xs font-medium text-slate-400" style={{ width: LEFT_W, flexShrink: 0 }}>
                TASK NAME
              </div>
              <div className="flex border-b border-slate-200 bg-white" style={{ width: contentWidth }}>
                {segments.map((seg) => (
                  <div key={seg.key} style={{ width: seg.width }} className="flex items-center justify-center text-xs font-medium text-slate-500 border-r border-slate-200">
                    {seg.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex" style={{ height: DAY_ROW_H }}>
              <div className="sticky left-0 z-30 bg-white border-r border-b border-slate-200" style={{ width: LEFT_W, flexShrink: 0 }} />
              <div className="relative bg-white border-b border-slate-200" style={{ width: contentWidth, height: DAY_ROW_H }}>
                {weekendDays.map((d) => (
                  <div
                    key={`wk-${d.key}`}
                    className="absolute top-0 bottom-0 bg-slate-100"
                    style={{ left: d.x, width: dayWidth }}
                  />
                ))}
                {days.map((d) => (
                  <div
                    key={d.key}
                    className="absolute top-0 bottom-0 flex items-center justify-center border-r border-slate-200"
                    style={{ left: d.x, width: dayWidth, color: d.isWeekend ? "#94a3b8" : "#64748b", fontSize: 10 }}
                  >
                    {showDayLabels ? String(d.label).padStart(2, "0") : ""}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vertical day/month gridlines behind the chart */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: LEFT_W, top: HEADER_H, width: contentWidth, height: rows.length * ROW_H, zIndex: 0 }}
          >
            {days.map((d) => (
              <line
                key={`grid-${d.key}`}
                x1={d.x} y1={0} x2={d.x} y2={rows.length * ROW_H}
                stroke={d.isMonthStart ? "#cbd5e1" : "#e7ebf1"}
                strokeWidth={d.isMonthStart ? 1.2 : 1}
              />
            ))}
          </svg>

          {/* Rows */}
          {rows.map((t, i) => {
            const pt = pointFor(t);
            const isMilestone = t.type === "milestone";
            const meta = STATE_META[t.state] || STATE_META.inprogress;
            const isCritical = highlightCritical && criticalInfo.criticalIds.has(t.id);
            return (
              <div key={t.id} className="flex border-b border-slate-200 group" style={{ height: ROW_H }}>
                {/* Left cell */}
                <div
                  className="sticky left-0 z-10 bg-white border-r border-slate-200 flex items-center pr-1"
                  style={{ width: LEFT_W, flexShrink: 0, paddingLeft: 10 + t.depth * 16 }}
                >
                  {t.hasChildren ? (
                    <button onClick={() => toggleCollapse(t.id)} className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-700 shrink-0">
                      {t.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                  ) : (
                    <span className="w-5 shrink-0" />
                  )}
                  <span
                    className="h-2 w-2 rounded-full shrink-0 mr-1.5"
                    style={{ background: t.color }}
                  />
                  <button
                    onClick={() => setDetailTaskId(t.id)}
                    className={`truncate text-left hover:underline ${t.depth === 0 ? "font-medium" : ""}`}
                    style={{ fontSize: 13, color: isCritical ? "#dc2626" : t.depth === 0 ? "#1e293b" : "#475569" }}
                    title={isCritical ? `${t.name} (on critical path)` : t.name}
                  >
                    {t.name}
                  </button>
                  <button
                    onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ id: t.id, x: r.right - 170, y: r.bottom + 4 }); }}
                    className="ml-auto h-6 w-6 shrink-0 flex items-center justify-center rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>

                {/* Right cell (bar / milestone) */}
                <div
                  data-task-row={t.id}
                  className="relative"
                  style={{ width: contentWidth, flexShrink: 0 }}
                >
                  {weekendDays.map((d) => (
                    <div
                      key={`row-wk-${t.id}-${d.key}`}
                      className="absolute top-0 bottom-0 bg-slate-50 pointer-events-none"
                      style={{ left: d.x, width: dayWidth }}
                    />
                  ))}
                  {isMilestone ? (
                    <div
                      className="absolute flex items-center group cursor-pointer"
                      style={{ left: pt.x0 - 11, top: (ROW_H - 26) / 2, width: 22, height: 26 }}
                      onMouseDown={(e) => beginDrag(e, t, "move")}
                      onDoubleClick={() => setDetailTaskId(t.id)}
                    >
                      <svg width="22" height="26" viewBox="0 0 22 26" style={{ overflow: "visible" }}>
                        <polygon
                          points="11,3 19,13 11,23 3,13"
                          fill={t.color}
                          stroke={isCritical ? "#dc2626" : "rgba(0,0,0,0.15)"}
                          strokeWidth={isCritical ? 2.5 : 1}
                        />
                      </svg>
                      <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-medium" style={{ left: 26, color: isCritical ? "#dc2626" : "#334155" }}>{t.name}</span>
                      <div
                        className="absolute -right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-white opacity-0 group-hover:opacity-100 cursor-crosshair"
                        onMouseDown={(e) => beginConnect(e, t)}
                        title="Drag to create dependency"
                      />
                    </div>
                  ) : (
                    <div
                      className="absolute rounded-md flex items-center px-2 group shadow-sm cursor-grab active:cursor-grabbing"
                      style={{
                        left: pt.x0, top: (ROW_H - BAR_H) / 2, width: Math.max(pt.x1 - pt.x0, 10), height: BAR_H,
                        background: t.state === "cancelled" ? "repeating-linear-gradient(45deg, "+t.color+", "+t.color+" 6px, rgba(255,255,255,0.35) 6px, rgba(255,255,255,0.35) 12px)" : t.color,
                        opacity: t.state === "cancelled" ? 0.6 : 1,
                        boxShadow: isCritical ? "0 0 0 2px #dc2626, 0 1px 2px rgba(0,0,0,0.15)" : undefined,
                      }}
                      onMouseDown={(e) => beginDrag(e, t, "move")}
                      onDoubleClick={() => setDetailTaskId(t.id)}
                      title={t.hasChildren ? "Summary task — dates follow its subtasks. Drag to move the whole group." : undefined}
                    >
                      {/* progress overlay */}
                      <div className="absolute left-0 top-0 bottom-0 rounded-l-md pointer-events-none" style={{ width: `${t.progress}%`, backgroundColor: "rgba(0,0,0,0.15)", borderTopRightRadius: t.progress >= 99 ? 6 : 0, borderBottomRightRadius: t.progress >= 99 ? 6 : 0 }} />
                      <StateBadge state={t.state} size={11} />
                      <span className="ml-1.5 font-medium text-white truncate relative" style={{ fontSize: 11.5 }}>{t.name}</span>
                      <span className="ml-auto pl-2 relative shrink-0" style={{ fontSize: 10.5, color: "rgba(255,255,255,0.8)" }}>{t.progress}%</span>

                      {/* resize handles — summary tasks derive their span from subtasks, so no direct resize */}
                      {!t.hasChildren && (
                        <>
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 rounded-l-md"
                            style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                            onMouseDown={(e) => beginDrag(e, t, "left")}
                          />
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 rounded-r-md"
                            style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
                            onMouseDown={(e) => beginDrag(e, t, "right")}
                          />
                        </>
                      )}
                      {/* connector handle */}
                      <div
                        className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-amber-500 border-2 border-white opacity-0 group-hover:opacity-100 cursor-crosshair z-10"
                        onMouseDown={(e) => beginConnect(e, t)}
                        title="Drag to create dependency"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Today marker */}
          {showToday && (
            <div
              className="absolute top-0 w-px bg-red-400 pointer-events-none z-20"
              style={{ left: LEFT_W + todayX, height: HEADER_H + rows.length * ROW_H }}
            >
              <div className="absolute -top-0 -left-1.5 w-0 h-0" style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "6px solid #f87171" }} />
            </div>
          )}

          {/* Dependency overlay */}
          <svg
            className="absolute pointer-events-none z-10"
            style={{ left: LEFT_W, top: HEADER_H, width: contentWidth, height: rows.length * ROW_H }}
          >
            {rows.flatMap((t) =>
              (t.dependsOn || []).map((pid) => ({ pid, t, isCrit: highlightCritical && criticalInfo.criticalEdges.has(`${pid}->${t.id}`) }))
            ).sort((a, b) => (a.isCrit === b.isCrit ? 0 : a.isCrit ? 1 : -1))
              .map(({ pid, t, isCrit }) => {
                if (!(pid in rowIndexOf) || !(t.id in rowIndexOf)) return null;
                const p = pointFor(tasks.find((x) => x.id === pid));
                const c = pointFor(t);
                const pts = dependencyRoute(p, c, ROW_H);
                const d = routeToSvgPath(pts);
                const color = isCrit ? "#dc2626" : "#f59e0b";
                return (
                  <g key={`${pid}-${t.id}`}>
                    <path d={d} fill="none" stroke={color} strokeWidth={isCrit ? 2.5 : 1.5} pointerEvents="none" />
                    <polygon points={`${c.x0 - 3},${c.y - 4} ${c.x0 + 3},${c.y} ${c.x0 - 3},${c.y + 4}`} fill={color} pointerEvents="none" />
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="12"
                      style={{ cursor: "pointer", pointerEvents: "auto" }}
                      onClick={(e) => { e.stopPropagation(); setDepMenu({ predId: pid, taskId: t.id, x: e.clientX, y: e.clientY }); }}
                    >
                      <title>Click to delete this dependency</title>
                    </path>
                  </g>
                );
              })}
            {connectPreview && (
              <line
                x1={connectPreview.x1 - LEFT_W} y1={connectPreview.y1 - HEADER_H}
                x2={connectPreview.x2 - LEFT_W} y2={connectPreview.y2 - HEADER_H}
                stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="h-10 shrink-0 flex items-center gap-4 px-4 border-t border-slate-200 bg-white text-xs text-slate-500 overflow-x-auto">
        {STATE_KEYS.map((k) => {
          const m = STATE_META[k];
          return (
            <span key={k} className="flex items-center gap-1.5 shrink-0">
              <span className="h-3.5 w-3.5 rounded-full flex items-center justify-center" style={{ background: m.color }}>
                <m.Icon size={9} color="#fff" />
              </span>
              {m.label}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5 shrink-0 ml-2">
          <svg width="12" height="14" viewBox="0 0 18 22"><polygon points="9,1 17,11 9,21 1,11" fill="#475569" /></svg>
          Milestone
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: "#ef4444" }} />
          Critical path
        </span>
      </div>

      {menu && (
        <RowMenu
          x={menu.x} y={menu.y}
          onClose={() => setMenu(null)}
          onEdit={() => { setDetailTaskId(menu.id); setMenu(null); }}
          onAddTask={() => addChild(menu.id, "task")}
          onAddMilestone={() => addChild(menu.id, "milestone")}
          onDelete={() => deleteTask(menu.id)}
        />
      )}

      {depMenu && (
        <DepMenu
          x={depMenu.x} y={depMenu.y}
          onClose={() => setDepMenu(null)}
          onDelete={() => deleteDependency(depMenu.predId, depMenu.taskId)}
        />
      )}

      {projSwitcherOpen && projBtnRef.current && (
        <ProjectSwitcher
          projects={projects}
          currentId={currentProjectId}
          anchorRect={projBtnRef.current.getBoundingClientRect()}
          onSelect={selectProject}
          onRename={renameProject}
          onDelete={deleteProject}
          onCreate={createProject}
          onClose={() => setProjSwitcherOpen(false)}
        />
      )}

      {detailTask && (
        <DetailModal task={detailTask} hasChildren={detailHasChildren} onSave={saveDetail} onDelete={deleteTask} onClose={() => setDetailTaskId(null)} />
      )}

      {exportOpen && (
        <ExportModal tasks={tasks} projectName={currentProject.name} bounds={bounds} onClose={() => setExportOpen(false)} />
      )}

      {sCurveOpen && (
        <SCurveModal tasks={tasks} bounds={bounds} todayIso={todayStr} onClose={() => setSCurveOpen(false)} />
      )}
    </div>
  );
}
