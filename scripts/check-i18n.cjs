const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, '../src/locales');
const enPath = path.join(localesPath, 'en', 'translation.json');
const esPath = path.join(localesPath, 'es', 'translation.json');
const zhPath = path.join(localesPath, 'zh', 'translation.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
    } else {
      keys.push(prefix + key);
    }
  }
  return keys;
}

const enKeys = getKeys(en);
const esKeys = getKeys(es);
const zhKeys = getKeys(zh);

function compareKeys(base, compare, name) {
  const missing = base.filter(k => !compare.includes(k));
  if (missing.length > 0) {
    console.error(`Missing keys in ${name}:`, missing);
    return false;
  }
  return true;
}

let passed = true;
if (!compareKeys(enKeys, esKeys, 'es')) passed = false;
if (!compareKeys(enKeys, zhKeys, 'zh')) passed = false;

if (!passed) {
  process.exit(1);
} else {
  console.log('i18n check passed!');
}
