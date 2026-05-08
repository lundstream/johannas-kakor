import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, 'settings.json');

if (!fs.existsSync(SETTINGS_PATH)) {
  console.error('settings.json not found. Copy settings.example.json to settings.json.');
  process.exit(1);
}

export const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
