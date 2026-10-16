// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// Shared by the OQC record (OQC Data Information) and the SPEC master, which is laid out like it
const bi = (km, en) => `<span class="km">${km}</span><span class="en">[${en}]</span>`;
const OQC_CIRC = ['①', '②', '③', '④', '⑤'];
const OQC_INFO = [
  ['ឈ្មោះអតិថិជន', 'CUSTOMER', 'oqcCustomer'], ['ឈ្មោះផលិតផល', 'PART №', 'oqcPart'], ['លេខឡត', 'LOT №', 'oqcLot'],
  ['ចំនួនផលិត', 'QUANTITY', 'oqcQty'], ['ចំនួនចាប់ត្រួតពិនិត្យ', 'SPOT CHECK', 'oqcSpot'], ['ប្រូបាបចាប់ពិនិត្យ', 'Probability', 'oqcProb']
];
const OQC_MATERIAL = [['①', 'ខ្សែ', 'Wire'], ['②', 'ធីរមីណល', 'Terminal'], ['③', 'ហៅស៊ីង', 'Housing'], ['④', 'ផ្សេងៗ', 'Other']];
const OQC_ITEMS = [
  // [Khmer, English, default result] — "/" means not applicable
  ['3) ឆ្លងកាត់តេស្តចរន្ត', 'CONDUCTIVITY TEST', 'OK'],
  ['4) លក្ខណៈការបញ្ចូលខ្សែ', "WIRE ASS'Y CONDITION", 'OK'],
  ['5) លក្ខណៈការដោតចូល', 'INSERTION CONDITION', 'OK'],
  ['6) លក្ខណៈគៀប', 'CRIMPING CONDITION', 'OK'],
  ['7) លក្ខណៈសង្កត់', 'PRESSING CONDITION', 'OK'],
  ['8) លក្ខណៈចងខ្សែ', 'TIE CABLE CONDITION', 'OK'],
  ['9) លក្ខណៈផ្សារសំណ', 'SOLDERING CONDITION', 'OK'],
  ['10) ត្រួតពិនិត្យសោភ័ណភាព', 'APPEARANCE CHECK', 'OK'],
  ['11) ត្រួតពិនិត្យបរិស្ថាន (RoHS)', 'RoHS ENVIRONMENTAL CONSERVATION CHECK', 'OK']
];
const oqcHead = right => `<div class="oqc-head">
    <div class="oqc-co"><b>MARUNIX(CAMBODIA)Co.,Ltd</b><span>ម៉ារូនិក(ខេមបូឌា)</span></div>
    <div class="oqc-title"><span class="km">តារាងត្រួតពិនិត្យផលិតផល</span><b>[OQC Inspection record]</b></div>
    <div class="oqc-ref"><small>REF: QC-RE-002 &nbsp;REV:02 &nbsp;Date: 01/04/2026</small>${right}</div>
  </div>`;
