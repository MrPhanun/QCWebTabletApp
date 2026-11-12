const { sql, getPool } = require('../db');
const { sendJson, readJson } = require('../http');

// GET /api/ui-settings: the saved look of the OQC Data Information screen { settings: { key: value } }
// PUT { settings: {...} }: save it ({} = back to default). The browser checks each value against its own list of
// options before using it; here only the shape is checked (short keys, numbers, colours / font names).
const SCREEN = 'oqc';

// The saved settings and when they were last saved (Date, or null); {} when nothing is saved or the table is not there yet
async function loadUiSettings() {
  try {
    const { recordset } = await (await getPool()).request().input('k', sql.VarChar(50), SCREEN)
      .query('SELECT SettingValue, DATEDIFF(SECOND, UpdateDate, GETDATE()) AS age FROM MstUiSetting WHERE SettingKey = @k');
    if (!recordset.length) return { settings: {}, updatedAt: null };
    // (from its age, so the database server's time zone does not matter when it is compared with file times)
    return { settings: JSON.parse(recordset[0].SettingValue) || {}, updatedAt: new Date(Date.now() - recordset[0].age * 1000 - 1000) };
  } catch (err) {
    console.error('UI settings:', err.message);
    return { settings: {}, updatedAt: null };
  }
}
const KEY = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
const TEXT = /^[#a-zA-Z0-9 _-]{0,40}$/;

async function handleUiSettings(req, res, session) {
  try {
    const pool = await getPool();
    const load = async () => {
      try {
        const { recordset } = await pool.request().input('k', sql.VarChar(50), SCREEN)
          .query('SELECT SettingValue FROM MstUiSetting WHERE SettingKey = @k');
        return recordset.length ? JSON.parse(recordset[0].SettingValue) || {} : {};
      } catch (err) {
        // Table not created yet (db/013_MstUiSetting.sql): the screen just uses the default look
        if (req.method === 'GET') { console.error('UI settings:', err.message); return {}; }
        throw err;
      }
    };
    if (req.method === 'GET') return sendJson(res, 200, { settings: await load() });
    if (req.method !== 'PUT') return sendJson(res, 405, { error: 'Method not allowed' });

    let body;
    try { body = await readJson(req, 20000); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
    const s = body && body.settings;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return sendJson(res, 400, { error: 'Invalid request' });
    const clean = {};
    for (const [k, v] of Object.entries(s)) {
      if (!KEY.test(k) || Object.keys(clean).length >= 100) return sendJson(res, 400, { error: 'Invalid request' });
      if (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10000) clean[k] = v;
      else if (typeof v === 'string' && TEXT.test(v)) clean[k] = v;
      else return sendJson(res, 400, { error: 'Invalid request' });
    }
    await pool.request().input('k', sql.VarChar(50), SCREEN).input('v', sql.NVarChar(sql.MAX), JSON.stringify(clean))
      .input('by', sql.VarChar(80), session.id)
      .query(`MERGE MstUiSetting AS t USING (SELECT @k AS SettingKey) AS s ON t.SettingKey = s.SettingKey
        WHEN MATCHED THEN UPDATE SET SettingValue = @v, UpdateBy = @by, UpdateDate = GETDATE()
        WHEN NOT MATCHED THEN INSERT (SettingKey, SettingValue, UpdateBy) VALUES (@k, @v, @by);`);
    sendJson(res, 200, { settings: clean });
  } catch (err) {
    console.error('UI settings error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

module.exports = { handleUiSettings, loadUiSettings };
