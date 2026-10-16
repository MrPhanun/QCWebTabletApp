// Environment config: config/<env>.json plus the secrets in .env.<env>
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// Pick environment: --env=development|production, else NODE_ENV, else development
const arg = process.argv.find(a => a.startsWith('--env='));
const envName = (arg && arg.split('=')[1]) || process.env.NODE_ENV || 'development';
const configFile = path.join(ROOT, 'config', `${envName}.json`);
if (!fs.existsSync(configFile)) {
  console.error(`Unknown environment "${envName}". Use development or production.`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

// Secrets live in .env.<env> (gitignored). Real environment variables take precedence.
const envFile = path.join(ROOT, `.env.${envName}`);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
config.database.password = process.env.DB_PASSWORD;
const PORT = process.env.PORT || config.port;

module.exports = { config, envName, PORT };
