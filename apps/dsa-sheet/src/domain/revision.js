import { REV_DAYS } from "../data/sheets.js";
import { S, save, notify } from "../state/store.js";

const DAY_MS = 864e5;

const dayNum = (ts) => {
  const d = new Date(ts);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
};

export const fmtShort = (ts) =>
  new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function normRev(raw) {
  const a = Array.isArray(raw) ? [raw[0] || 0, raw[1] || 0, raw[2] || 0] : [0, 0, 0];
  if (!a[0]) {
    a[1] = 0;
    a[2] = 0;
  } else if (!a[1]) {
    a[2] = 0;
  }
  return a;
}

export function revInfo(qid) {
  const solvedAt = S.done[qid];
  const arr = normRev(S.rev[qid]);
  const solvedDay = dayNum(solvedAt || Date.now());
  const today = dayNum(Date.now());

  const stages = REV_DAYS.map((d, i) => {
    const done = !!arr[i];
    const locked = i > 0 && !arr[i - 1];
    const dueDay = solvedDay + d;
    const delta = dueDay - today;
    const state = done
      ? "done"
      : locked
      ? "locked"
      : delta < 0
      ? "overdue"
      : delta === 0
      ? "due"
      : "upcoming";
    return { day: d, done, locked, ts: arr[i] || 0, dueDay, delta, state };
  });

  const nextIdx = stages.findIndex((s) => !s.done);
  const mastered = nextIdx === -1;
  const nextDelta = mastered ? 999999 : stages[nextIdx].delta;
  const status = mastered
    ? "mastered"
    : nextDelta < 0
    ? "overdue"
    : nextDelta === 0
    ? "due"
    : "upcoming";
  const badge = mastered
    ? "Mastered"
    : nextDelta < 0
    ? `Overdue ${-nextDelta}d`
    : nextDelta === 0
    ? "Due today"
    : `In ${nextDelta}d`;

  return { stages, nextIdx, mastered, nextDelta, status, badge, solvedAt: solvedAt || 0 };
}

export function toggleRev(qid, idx) {
  S.rev = S.rev || {};
  const arr = normRev(S.rev[qid]);
  if (!arr[idx]) {
    if (idx > 0 && !arr[idx - 1]) return; // Strict 1 -> 3 -> 7 order
    arr[idx] = Date.now();
  } else {
    for (let k = idx; k < REV_DAYS.length; k++) arr[k] = 0; // Cascade undo
  }
  S.rev[qid] = arr;
  save();
  notify();
}

export function buildRevQueue(sheetsList) {
  // Min-heap priority queue: overdue -> due today -> upcoming -> mastered
  const heap = [];
  const cmp = (a, b) => {
    if (a.info.mastered !== b.info.mastered) return a.info.mastered ? 1 : -1;
    if (a.info.nextDelta !== b.info.nextDelta) return a.info.nextDelta - b.info.nextDelta;
    const sa = S.star[a.q.id] ? 1 : 0;
    const sb = S.star[b.q.id] ? 1 : 0;
    if (sa !== sb) return sb - sa;
    if (a.info.nextIdx !== b.info.nextIdx) return a.info.nextIdx - b.info.nextIdx;
    return a.info.solvedAt - b.info.solvedAt;
  };

  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (cmp(heap[i], heap[p]) >= 0) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  };

  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let s = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < heap.length && cmp(heap[l], heap[s]) < 0) s = l;
        if (r < heap.length && cmp(heap[r], heap[s]) < 0) s = r;
        if (s === i) break;
        [heap[i], heap[s]] = [heap[s], heap[i]];
        i = s;
      }
    }
    return top;
  };

  const seen = new Set();
  sheetsList.forEach((s) =>
    s.topics.forEach((t) =>
      t.qs.forEach((q) => {
        if (S.done[q.id] && !seen.has(q.id)) {
          seen.add(q.id);
          push({ q, sheet: s.name, topic: t.n, info: revInfo(q.id) });
        }
      })
    )
  );

  const out = [];
  while (heap.length) out.push(pop());
  return out;
}
