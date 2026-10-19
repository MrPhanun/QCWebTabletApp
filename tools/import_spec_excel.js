// Import SPEC master data from an Excel file with sheets "MstSpec" and "MstSpecLength" (same columns as the tables).
//   node tools/import_spec_excel.js "All Parts - Header & Detail_4.xlsx" --env=development [--dry-run] [--replace]
// --replace first deletes every Part No in MstSpec / MstSpecLength, so the tables hold exactly the file's data.
// MstSpec rows are matched by PartNo (inserted, or updated if the Part No exists); the length lines of each
// imported Part No are replaced by the sheet's lines. MstSpecLength.SpecNo in the sheet refers to MstSpec.SysNo
// in the sheet. Range is worked out with server/spec-range.js like a normal save (the sheet's Range is ignored).
// Everything runs in one transaction: any error leaves the database unchanged.
const ExcelJS = require('exceljs');
const { sql, getPool } = require('../server/db');
const { specRange } = require('../server/spec-range');

const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
const replace = process.argv.includes('--replace');
if (!file) { console.error('Usage: node tools/import_spec_excel.js <file.xlsx> --env=<env> [--dry-run] [--replace]'); process.exit(1); }

// Cell value as plain text / number / date
function cell(row, col) {
  const v = row.getCell(col).value;
  if (v == null) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map(t => t.text).join('');
  if (typeof v === 'object' && 'result' in v) return v.result ?? '';
  if (typeof v === 'object' && v.text) return v.text;
  return v;
}
const text = v => (v instanceof Date ? v.toISOString() : String(v)).trim();
const date = v => (v instanceof Date ? v : v ? new Date(v) : new Date());

function rows(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Sheet "${name}" not found`);
  const out = [];
  ws.eachRow((row, i) => { if (i > 1) out.push(row); });
  return out;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  // MstSpec: SysNo, Customer, PartNo, Wire, Terminal, Housing, Other, RegBy, RegDate, UpdateBy, UpdateDate
  const specs = rows(wb, 'MstSpec').map(r => ({
    sheetNo: Number(cell(r, 1)), customer: text(cell(r, 2)), partNo: text(cell(r, 3)),
    wire: text(cell(r, 4)), terminal: text(cell(r, 5)), housing: text(cell(r, 6)), other: text(cell(r, 7)),
    regBy: text(cell(r, 8)) || 'import', regDate: date(cell(r, 9)),
    updateBy: text(cell(r, 10)) || text(cell(r, 8)) || 'import', updateDate: date(cell(r, 11)),
    lines: []
  })).filter(s => s.partNo);

  const bySheetNo = new Map();
  const partNos = new Set();
  for (const s of specs) {
    if (bySheetNo.has(s.sheetNo)) throw new Error(`MstSpec: SysNo ${s.sheetNo} repeated`);
    if (partNos.has(s.partNo)) throw new Error(`MstSpec: PartNo ${s.partNo} repeated`);
    bySheetNo.set(s.sheetNo, s); partNos.add(s.partNo);
  }

  // MstSpecLength: SpecNo, LineNo, Position, Spec, SpecMinus, SpecPlus, Range
  for (const r of rows(wb, 'MstSpecLength')) {
    const specNo = Number(cell(r, 1)), lineNo = Number(cell(r, 2));
    if (!specNo && !lineNo) continue;
    const s = bySheetNo.get(specNo);
    if (!s) throw new Error(`MstSpecLength row ${r.number}: SpecNo ${specNo} not in MstSpec sheet`);
    if (!(Number.isInteger(lineNo) && lineNo >= 1 && lineNo <= 200)) throw new Error(`MstSpecLength row ${r.number}: LineNo ${lineNo} not 1-200`);
    if (s.lines.some(l => l.lineNo === lineNo)) throw new Error(`MstSpecLength row ${r.number}: SpecNo ${specNo} LineNo ${lineNo} repeated`);
    const spec = text(cell(r, 4)), minus = text(cell(r, 5)), plus = text(cell(r, 6));
    s.lines.push({ lineNo, position: text(cell(r, 3)), spec, minus, plus, range: specRange(spec, minus, plus) });
  }

  const lineCount = specs.reduce((n, s) => n + s.lines.length, 0);
  console.log(`${file}: ${specs.length} Part No, ${lineCount} length lines`);
  if (dryRun) { console.log('Dry run: nothing written'); process.exit(0); }

  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  let inserted = 0, updated = 0;
  try {
    if (replace) {
      const { recordset } = await new sql.Request(tx).query('SELECT COUNT(*) AS n FROM MstSpec; DELETE FROM MstSpecLength; DELETE FROM MstSpec;');
      console.log(`--replace: ${recordset[0].n} existing Part No deleted`);
    }
    for (const s of specs) {
      const { recordset } = await new sql.Request(tx)
        .input('customer', sql.NVarChar(100), s.customer).input('partNo', sql.NVarChar(100), s.partNo)
        .input('wire', sql.NVarChar(1000), s.wire).input('terminal', sql.NVarChar(1000), s.terminal)
        .input('housing', sql.NVarChar(1000), s.housing).input('other', sql.NVarChar(1000), s.other)
        .input('regBy', sql.VarChar(80), s.regBy).input('regDate', sql.DateTime, s.regDate)
        .input('updateBy', sql.VarChar(80), s.updateBy).input('updateDate', sql.DateTime, s.updateDate)
        .query(`
          DECLARE @id int = (SELECT SysNo FROM MstSpec WHERE PartNo = @partNo), @new bit = 0;
          IF @id IS NULL
          BEGIN
            INSERT INTO MstSpec (Customer, PartNo, Wire, Terminal, Housing, Other, RegBy, RegDate, UpdateBy, UpdateDate)
            VALUES (@customer, @partNo, @wire, @terminal, @housing, @other, @regBy, @regDate, @updateBy, @updateDate);
            SELECT @id = SCOPE_IDENTITY(), @new = 1;
          END
          ELSE
            UPDATE MstSpec SET Customer = @customer, Wire = @wire, Terminal = @terminal, Housing = @housing, Other = @other,
              UpdateBy = @updateBy, UpdateDate = @updateDate WHERE SysNo = @id;
          DELETE FROM MstSpecLength WHERE SpecNo = @id;
          SELECT @id AS id, @new AS isNew;`);
      const { id, isNew } = recordset[0];
      if (isNew) inserted++; else updated++;

      // Up to 200 lines x 7 parameters per statement stays under SQL Server's 2100-parameter limit
      if (s.lines.length) {
        const req = new sql.Request(tx).input('id', sql.Int, id);
        const values = s.lines.map((l, i) => {
          req.input(`n${i}`, sql.TinyInt, l.lineNo).input(`p${i}`, sql.NVarChar(100), l.position)
            .input(`s${i}`, sql.NVarChar(100), l.spec).input(`m${i}`, sql.NVarChar(20), l.minus)
            .input(`u${i}`, sql.NVarChar(20), l.plus).input(`r${i}`, sql.NVarChar(30), l.range);
          return `(@id, @n${i}, @p${i}, @s${i}, @m${i}, @u${i}, @r${i})`;
        });
        await req.query(`INSERT INTO MstSpecLength (SpecNo, [LineNo], Position, Spec, SpecMinus, SpecPlus, [Range]) VALUES ${values.join(',')}`);
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
  console.log(`MstSpec: ${inserted} inserted, ${updated} updated; MstSpecLength: ${lineCount} lines written`);
  process.exit(0);
})().catch(err => { console.error(err.message); process.exit(1); });
