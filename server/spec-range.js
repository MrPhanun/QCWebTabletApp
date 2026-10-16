// Range of a SPEC line, "min-max" (e.g. "8-12"): the values a measured sample may have to be OK.
// Saved with every SPEC line (MstSpecLength.Range) and used for the OK / NG (red) check of the samples.
//   10, -2, +2        -> 8-12        2±1mm   -> 1-3       0.5~2mm, 1-3mm -> 0.5-2, 1-3
//   ≤20, Max15, 10MAX -> 0-20, ...   (30), (L=30), 5Ref, NC, a plain number -> '' (nothing to check)
const NUM = '(\\d+(?:\\.\\d+)?)';
const fmt = n => String(+n.toFixed(4));
const num = s => (/^[+-]?\d+(\.\d+)?$/.test(String(s).trim()) ? Number(s) : NaN);

function specRange(spec, minus, plus) {
  const v = String(spec ?? '').trim(), m = String(minus ?? '').trim(), p = String(plus ?? '').trim();
  const range = (lo, hi) => (Number.isFinite(lo) && Number.isFinite(hi) ? `${fmt(Math.min(lo, hi))}-${fmt(Math.max(lo, hi))}` : '');
  // Value with its own tolerance columns
  // (a tolerance without a sign counts as - for SpecMinus and + for SpecPlus)
  if (Number.isFinite(num(v)) && (m || p)) {
    const lo = m ? num(/^[+-]/.test(m) ? m : '-' + m) : 0, hi = p ? num(p) : 0;
    return range(num(v) + lo, num(v) + hi);
  }
  if (m || p) return '';
  const t = v.replace(/\s*mm\b/gi, '').trim();
  let x;
  if ((x = t.match(new RegExp(`^${NUM}\\s*±\\s*${NUM}$`)))) return range(+x[1] - +x[2], +x[1] + +x[2]);
  if ((x = t.match(new RegExp(`^${NUM}\\s*\\(?\\s*\\+\\s*${NUM}\\s*/\\s*-\\s*${NUM}\\s*\\)?$`)))) return range(+x[1] - +x[3], +x[1] + +x[2]);
  if ((x = t.match(new RegExp(`^${NUM}\\s*(?:~|-|–|\\s)\\s*${NUM}$`)))) return range(+x[1], +x[2]);
  if ((x = t.match(new RegExp(`^(?:≤|<=|max\\s*:?\\s*ø?)\\s*${NUM}$`, 'i')))) return range(0, +x[1]);
  if ((x = t.match(new RegExp(`^${NUM}\\s*max$`, 'i')))) return range(0, +x[1]);
  return '';
}

module.exports = { specRange };
