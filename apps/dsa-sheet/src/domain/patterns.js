import { S, save, notify } from "../state/store.js";

export const qOwnTags = (qid) => (Array.isArray(S.tags[qid]) ? S.tags[qid] : []);

export const aTags = (a) => (a && Array.isArray(a.tags) ? a.tags : []);

// Returns deduplicated union of problem-level tags and all approach-level tags
export function qTags(qOrId) {
  if (!qOrId) return [];
  if (typeof qOrId === "string") return qOwnTags(qOrId);

  const out = [];
  const seen = new Set();
  const add = (t) => {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  };

  qOwnTags(qOrId.id).forEach(add);
  (qOrId.ap || []).forEach((a) => aTags(a).forEach(add));
  return out;
}

export function allUsedTags() {
  const set = new Set(Object.values(S.tags || {}).flat());
  (S.sheets || []).forEach((s) =>
    s.topics.forEach((t) =>
      t.qs.forEach((q) => (q.ap || []).forEach((a) => aTags(a).forEach((tg) => set.add(tg))))
    )
  );
  return [...set];
}

export function toggleFav(qid) {
  S.fav = S.fav || {};
  if (S.fav[qid]) delete S.fav[qid];
  else S.fav[qid] = 1;
  save();
  notify();
}

export function toggleTag(qid, tag) {
  const t = tag.trim();
  if (!t) return;
  S.tags = S.tags || {};
  const cur = [...qOwnTags(qid)];
  const idx = cur.findIndex((x) => x.toLowerCase() === t.toLowerCase());
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(t);
  if (cur.length) S.tags[qid] = cur;
  else delete S.tags[qid];
  save();
}

export function toggleApproachTag(approach, tag) {
  const t = tag.trim();
  if (!t || !approach) return;
  const cur = [...aTags(approach)];
  const idx = cur.findIndex((x) => x.toLowerCase() === t.toLowerCase());
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(t);
  if (cur.length) approach.tags = cur;
  else delete approach.tags;
  save();
}
