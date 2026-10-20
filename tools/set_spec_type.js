// Set MstSpec.Type: every Part No in the file becomes 'First Slot', every other Part No becomes 'Normal'.
// The file has one Part No per line (a .txt/.csv, first column is used). Add --dry-run to only count.
//   node tools/set_spec_type.js --env=development "first-slot.txt"
const fs = require('fs');
const { sql, getPool } = require('../server/db');

const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
if (!file) { console.error('Usage: node tools/set_spec_type.js --env=<env> [--dry-run] <file>'); process.exit(1); }

(async () => {
  const parts = [...new Set(fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.split(/[,;\t]/)[0].trim()).filter(Boolean))];
  const pool = await getPool();
  const have = new Set((await pool.request().query('SELECT PartNo FROM MstSpec')).recordset.map(r => r.PartNo));
  const found = parts.filter(p => have.has(p)), missing = parts.filter(p => !have.has(p));
  console.log(`${parts.length} Part No in the file: ${found.length} found in MstSpec, ${missing.length} not found`);
  if (missing.length) console.log('Not found:', missing.join(', '));
  if (dryRun) { console.log('Dry run: nothing written'); process.exit(0); }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query(`UPDATE MstSpec SET [Type] = 'Normal' WHERE [Type] <> 'Normal'`);
    // A Part No that already has an OQC record (draft or saved) is Normal, not First Slot
    for (const p of found) await new sql.Request(tx).input('p', sql.NVarChar(100), p)
      .query(`UPDATE MstSpec SET [Type] = 'First Slot' WHERE PartNo = @p AND NOT EXISTS (SELECT 1 FROM OqcRecord WHERE PartNo = @p)`);
    await tx.commit();
  } catch (err) { await tx.rollback().catch(() => {}); throw err; }
  const n = (await pool.request().query(`SELECT COUNT(*) AS n FROM MstSpec WHERE [Type] = 'First Slot'`)).recordset[0].n;
  console.log(`Done: ${n} First Slot, ${have.size - n} Normal (${found.length - n} listed Part No already have an OQC record, kept Normal)`);
  process.exit(0);
})().catch(err => { console.error(err.message); process.exit(1); });
