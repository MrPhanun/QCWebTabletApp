const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Excel file (Buffer) -> printed straight on a printer (default "Microsoft Print to PDF") with Microsoft Excel on this PC
// (print-xlsx.ps1), written to a file without asking. Jobs run one at a time (Excel automation is not re-entrant).
const TIMEOUT_MS = 90000;

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'print-xlsx.ps1'), ...args], { windowsHide: true });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => { p.kill(); reject(new Error('Printing timed out')); }, TIMEOUT_MS);
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(err.trim().split('\n')[0] || `exit code ${code}`)); });
  });
}

// Wait until the printer driver has written the file (it appears, then stops growing)
async function waitForFile(file) {
  let last = -1;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    const size = fs.existsSync(file) ? fs.statSync(file).size : -1;
    if (size > 0 && size === last) return;
    last = size;
  }
  throw new Error('The PDF was not created');
}

// <folder>\<base><ext>; an existing file is kept: <base> (2)<ext>, (3) ...
function freeName(folder, base, ext = '.pdf') {
  let n = 1, file = path.join(folder, base + ext);
  while (fs.existsSync(file)) file = path.join(folder, `${base} (${++n})${ext}`);
  return file;
}

// Open a file in the program Windows uses for it (Excel for .xlsx, the PDF viewer for .pdf)
function openFile(file) {
  spawn('cmd.exe', ['/c', 'start', '', file], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
}

let queue = Promise.resolve();
// Prints the workbook to <printer> as a file in <folder>; resolves with the saved file's path
function printXlsx(buffer, printer, folder, base, check = false) {
  const job = queue.then(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qc-print-' + crypto.randomBytes(4).toString('hex') + '-'));
    const xlsx = path.join(dir, 'OQC Data.xlsx');
    const out = check ? '' : freeName(folder, base);
    try {
      fs.writeFileSync(xlsx, Buffer.from(buffer));
      await run([xlsx, printer, out, ...(check ? ['-Check'] : [])]);
      if (!check) await waitForFile(out);
      return out;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  queue = job.catch(() => {});
  return job;
}

module.exports = { printXlsx, freeName, openFile };
