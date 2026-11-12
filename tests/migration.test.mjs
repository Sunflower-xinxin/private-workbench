import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const map = new Map();
globalThis.localStorage = {
  getItem: key => map.has(key) ? map.get(key) : null,
  setItem: (key, value) => map.set(key, String(value)),
  removeItem: key => map.delete(key), clear: () => map.clear()
};
const put = (key, value) => localStorage.setItem(key, JSON.stringify(value));
put('pw_records_notes', [{ id: 'note_1', content: '原随笔' }]);
put('pw_records_period', [{ id: 'period_1', start: '2026-01-01' }]);
put('pw_records_outfit', [
  { id: 'old_1', style: '极简通勤', top: '白衬衫', images: ['p1'] },
  { id: 'old_2', style: '极简通勤', note: '旧文字', images: ['p2'] }
]);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
new Function(readFileSync(join(root, 'store.js'), 'utf8'))();
const S = globalThis.PWStore;
if (!S.migrate()) throw new Error('migration did not run');
if (localStorage.getItem('pw_records_notes') || localStorage.getItem('pw_records_period')) throw new Error('removed module active keys remain');
const removed = JSON.parse(localStorage.getItem('pw_removed_modules_backup_v2'));
if (removed.data.notes[0].content !== '原随笔' || removed.data.period[0].id !== 'period_1') throw new Error('removed module archive invalid');
const legacy = JSON.parse(localStorage.getItem('pw_outfit_legacy_backup_v2'));
if (legacy.data.length !== 2) throw new Error('legacy outfit archive invalid');
const styles = S.list('outfit');
if (styles.length !== 1 || styles[0].name !== '极简通勤' || styles[0].images.join(',') !== 'p1,p2') throw new Error('outfit migration invalid');
if (S.migrate()) throw new Error('migration is not idempotent');
console.log('PASS  removed modules archived; legacy outfits converted; migration is idempotent');
