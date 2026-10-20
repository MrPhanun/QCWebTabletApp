// Excel / PDF of saved OQC records are kept on the server so a Printed record can be downloaded again without making it again:
// exports/oqc/<SysNo>.xlsx and .pdf. A changed record removes them (status back to Draft).
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'exports', 'oqc');

const recordFile = (id, ext) => path.join(DIR, `${Number(id)}${ext}`);
function saveRecordFile(id, ext, buf) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(recordFile(id, ext), Buffer.from(buf));
}
function removeRecordFiles(id) {
  for (const ext of ['.xlsx', '.pdf']) fs.rmSync(recordFile(id, ext), { force: true });
}
module.exports = { recordFile, saveRecordFile, removeRecordFiles };
