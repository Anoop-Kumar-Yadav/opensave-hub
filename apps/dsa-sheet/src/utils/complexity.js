export function cxScore(t) {
  const s = (t || "").toLowerCase().replace(/\s/g, "");
  if (!s) return null;
  if (/!/.test(s)) return 1;
  if (/2\^n|2ⁿ|2n\)/.test(s)) return 0.95;
  if (/n³|n\^3/.test(s)) return 0.85;
  if (/n²|n\^2|n\*n|n·n|n·m|nm|n\*m|v²|v\^2/.test(s)) return 0.7;
  if (/log/.test(s)) {
    return /(n|e|v|k)[·*]?log|log\(?[a-z]\)?[·*]\(?[a-z]/.test(s) && !/^o\(log/.test(s)
      ? 0.5
      : 0.12;
  }
  if (/√|sqrt/.test(s)) return 0.25;
  if (/^o\(1\)/.test(s)) return 0;
  return 0.38;
}

export function glow(a, list, glowCfg) {
  const g = glowCfg || { mode: "rel", int: 70 };
  const k = cxScore(a.time);
  if (k == null || g.mode === "off" || !g.int) return "";

  const unique = [...new Set(list.map((x) => cxScore(x.time)).filter((v) => v != null))].sort(
    (x, y) => x - y
  );
  const p =
    g.mode === "abs"
      ? Math.min(1, k)
      : unique.length > 1
      ? unique.indexOf(k) / (unique.length - 1)
      : 0;
  const hue = Math.round(p <= 0.5 ? 130 - 150 * p : 110 - 110 * p);
  const c = `hsl(${hue} 85% 46%`;
  const intensity = g.int / 100;
  const f = (n) => (n * intensity).toFixed(2);

  return (
    `border:${(1 + intensity * 1.2).toFixed(1)}px solid ${c});` +
    `box-shadow:0 0 0 1px ${c} / ${f(0.7)}),0 0 ${Math.round(26 * intensity)}px ${Math.round(
      5 * intensity
    )}px ${c} / ${f(0.55)});` +
    `background:linear-gradient(135deg,${c} / ${f(0.18)}),var(--card) 55%)`
  );
}
