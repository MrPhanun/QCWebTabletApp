// SQL Server connection (mssql)
const sql = require('mssql');
const { config } = require('./config');

// SQL Server connection pool (connects lazily, reconnects after a failure)
let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    const { server, database, user, password } = config.database;
    poolPromise = new sql.ConnectionPool({
      server, database, user, password,
      options: { encrypt: false, trustServerCertificate: true }
    }).connect().catch(err => { poolPromise = null; throw err; });
  }
  return poolPromise;
}

// Largest value of a SQL Server int column
const MAX_INT = 2147483647;

module.exports = { sql, getPool, MAX_INT };
