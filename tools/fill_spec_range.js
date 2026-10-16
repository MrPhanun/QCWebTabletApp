// Fill MstSpecLength.Range for every SPEC line from its Spec / SpecMinus / SpecPlus (see server/spec-range.js).
// Run once after adding the column (db/003_MstSpec.sql), and again any time it is safe to recompute:
//   node tools/fill_spec_range.js --env=development
const { sql, getPool } = require('../server/db');
const { specRange } = require('../server/spec-range');

(async () => {
  const pool = await getPool();
  const { recordset } = await pool.request().query('SELECT SpecNo, [LineNo], Spec, SpecMinus, SpecPlus, [Range] FROM MstSpecLength');
  let changed = 0, empty = 0;
  for (const l of recordset) {
    const range = specRange(l.Spec, l.SpecMinus, l.SpecPlus);
    if (!range) empty++;
    if (range === l.Range) continue;
    await pool.request().input('id', sql.Int, l.SpecNo).input('no', sql.TinyInt, l.LineNo).input('range', sql.NVarChar(30), range)
      .query('UPDATE MstSpecLength SET [Range] = @range WHERE SpecNo = @id AND [LineNo] = @no');
    changed++;
  }
  console.log(`${recordset.length} lines: ${changed} updated, ${empty} without a range (not checked)`);
  process.exit(0);
})().catch(err => { console.error(err.message); process.exit(1); });
