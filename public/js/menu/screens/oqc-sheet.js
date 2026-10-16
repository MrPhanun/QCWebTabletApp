// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// Shared by the OQC record (OQC Data Information) and the SPEC master, which is laid out like it
const bi = (km, en) => `<span class="km">${km}</span><span class="en">[${en}]</span>`;
const OQC_CIRC = ['①', '②', '③', '④', '⑤'];
const OQC_INFO = [
  ['ឈ្មោះអតិថិជន', 'CUSTOMER', 'oqcCustomer'], ['ឈ្មោះផលិតផល', 'PART №', 'oqcPart'], ['លេខឡត', 'LOT №', 'oqcLot'],
  ['ចំនួនផលិត', 'QUANTITY', 'oqcQty'], ['ចំនួនចាប់ត្រួតពិនិត្យ', 'SPOT CHECK', 'oqcSpot'], ['ប្រូបាបចាប់ពិនិត្យ', 'Probability', 'oqcProb']
];
const OQC_MATERIAL = [['①', 'ខ្សែ', 'Wire'], ['②', 'ធឺរមីណល', 'Terminal'], ['③', 'ហៅស៊ីង', 'Housing'], ['④', 'ផ្សេងៗ', 'Other']];
// 3) INSPECTION POINT, as on the form (Spec / OQC Data Information, 02/11/2026), in the template's row order
const OQC_ITEMS = [
  // [Khmer, English, default result] — "/" means not applicable
  ['① ឆ្លងកាត់តេស្តចរន្ត', 'CONDUCTIVITY TEST', 'OK'],
  ['② លក្ខណៈការបង្គុំខ្សែ', "WIRE ASS'Y CONDITION", 'OK'],
  ['③ លក្ខណៈការដោតចូល', 'INSERTION CONDITION', 'OK'],
  ['④ លក្ខណៈគៀប', 'CRIMPING CONDITION', 'OK'],
  ['⑤ លក្ខណៈសង្គត់', 'PRESSING CONDITION', 'OK'],
  ['⑥ លក្ខណៈចងខ្សែរ', 'CABLE TIE CONDITION', 'OK'],
  ['⑦ លក្ខណៈជ្រលក់សំនរ', 'SOLDERING CONDITION', 'OK'],
  ['⑧ ត្រួតពិនិត្យសោភ័ណ្ឌភាព', 'APPEARANCE CHECK', 'OK'],
  ['⑨ ត្រួតពិនិត្យលើបរិស្ថាន(RoHS)', 'RoHS ENVIRONMENTAL CONSERVATION CHECK', 'OK']
];
// Result keys renamed on the form: older saved records still use the old key
const OQC_ITEM_OLD_KEYS = { 'CABLE TIE CONDITION': 'TIE CABLE CONDITION' };
// A SPEC line (Spec, SpecMinus, SpecPlus) as written on the sheet: "30±5" when both sides are equal, else "100 (+10/-5)"
const specText = l => {
  const sign = (x, s) => /^[+-]?\d/.test(x) ? s + x.replace(/^[+-]/, '') : x;
  const v = String(l.spec || '').trim(), m = sign(String(l.specMinus || '').trim(), '-'), p = sign(String(l.specPlus || '').trim(), '+');
  if (!m && !p) return v;
  if (m && p && m.replace(/^-/, '') === p.replace(/^\+/, '')) return `${v}±${p.replace(/^\+/, '')}`;
  return `${v} (${[p, m].filter(Boolean).join('/')})`;
};
// The same SPEC text as HTML, written like the paper sheet: "100 (+10/-5)" -> 100 ± with 10 above 5; anything else as it is
const specHtml = text => {
  const N = '(\\d+(?:\\.\\d+)?)';
  const m = String(text || '').match(new RegExp(`^\\s*${N}\\s*\\(\\s*\\+\\s*${N}\\s*/\\s*-\\s*${N}\\s*\\)\\s*$`));
  return m ? `${m[1]}<span class="pm">±</span><span class="frac"><span>${m[2]}</span><span>${m[3]}</span></span>` : esc(String(text || ''));
};
// Length Position boxes show their text like the paper sheet, small and wrapped onto two lines when long
// ("16(EXLON_ AH-3 AWG 1)"); the box itself shows only while it is being edited
function showPositions(root) {
  root.querySelectorAll('.pos-view').forEach(v => {
    const text = v.parentElement.querySelector('[data-pos]').value;
    v.textContent = text;
    v.classList.toggle('long', text.length > 14);
  });
}
// Sheet header; kind 'spec' is the SPEC page (form QC-RE-048 "First Lot"), anything else OQC Data Information (QC-RE-002)
const OQC_FORMS = {
  oqc: { km: 'តារាងត្រួតពិនិត្យផលិតផល', en: 'OQC Inspection record', ref: 'REF: QC-RE-002 &nbsp;REV:03 &nbsp;Date: 02/11/2026' },
  spec: { km: 'តារាងត្រួតពិនិត្យផលិតផលឡតដំបូង', en: 'OQC Inspection record First Lot', ref: 'REF: QC-RE-048 &nbsp;REV:02 &nbsp;Date: 02/11/2026' }
};
const oqcHead = (right, kind = 'oqc') => `<div class="oqc-head">
    <div class="oqc-co"><b>MARUNIX(CAMBODIA)Co.,Ltd</b><span>ម៉ារ៉ូនិក(ខេមបូឌា)</span></div>
    <div class="oqc-title"><span class="km">${OQC_FORMS[kind].km}</span><b>[${OQC_FORMS[kind].en}]</b></div>
    <div class="oqc-ref"><small>${OQC_FORMS[kind].ref}</small>${right}</div>
  </div>`;
// Table headers of 1) MATERIAL CHECK and 3) INSPECTION POINT
const OQC_MAT_HEAD = `<tr><th>${bi('1) ត្រួតពិនិត្យវត្ថុធាតុដើម', 'MATERIAL CHECK')}</th><th class="c">${bi('លទ្ធផល', 'Result')}</th></tr>`;
const OQC_ITEM_HEAD = `<tr><th>${bi('3) ប្រការត្រូវត្រួតពិនិត្យ', 'INSPECTION POINT')}</th><th class="c">${bi('លទ្ធផល', 'Result')}</th></tr>`;
