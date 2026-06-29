import { CONFIG, HEADERS, SHEETS } from './config.js';
import { state } from './state.js';
import { clean } from './utils.js';
import { setSync } from './ui.js';

function apiUrl(path) {
  return CONFIG.proxyUrl.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

export async function loadWorkbook() {
  setSync('Загрузка файла...');
  const response = await fetch(apiUrl('/download?public_key=' + encodeURIComponent(CONFIG.publicKey)));
  if (!response.ok) throw new Error('Не удалось загрузить Excel-файл');
  state.workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
  state.instruments = readSheet(SHEETS.instruments, HEADERS.instruments);
  state.history = readSheet(SHEETS.history, HEADERS.history);
  state.users = readSheet(SHEETS.users, HEADERS.users);
  state.retired = readSheet(SHEETS.retired, HEADERS.retired);
  normalizeLoadedData();
  setSync('Файл загружен');
}

export async function saveWorkbook(message = 'Сохранено') {
  setSync('Сохранение...');
  console.log('saveWorkbook: начинаем сохранение');

  writeSheet(SHEETS.instruments, HEADERS.instruments, state.instruments);
  writeSheet(SHEETS.history, HEADERS.history, state.history);
  writeSheet(SHEETS.users, HEADERS.users, state.users);
  writeSheet(SHEETS.retired, HEADERS.retired, state.retired);

  const wbout = XLSX.write(state.workbook, { bookType: 'xlsx', type: 'array' });
  console.log('saveWorkbook: размер данных для загрузки', wbout.length);

  // Используем Blob для правильной передачи бинарных данных
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  console.log('saveWorkbook: отправка запроса на /upload');
  const response = await fetch(apiUrl('/upload'), {
    method: 'PUT',
    headers: {
      'X-Write-Secret': CONFIG.writeSecret
    },
    body: blob
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('saveWorkbook: ошибка загрузки', response.status, errorText);
    throw new Error('Не удалось сохранить Excel-файл: ' + response.status + ' ' + errorText);
  }

  const result = await response.json();
  console.log('saveWorkbook: ответ сервера', result);
  setSync(message);
}

function readSheet(name, headers) {
  const sheet = state.workbook.Sheets[name];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) return [];
  const first = rows[0].map((c) => String(c).trim());
  const hasHeaders = headers.every((h) => first.includes(h));
  const sourceHeaders = hasHeaders ? first : headers;
  const dataRows = hasHeaders ? rows.slice(1) : rows;
  return dataRows.map((row) =>
    Object.fromEntries(sourceHeaders.map((h, i) => [h, clean(row[i])]))
  ).filter((row) => Object.values(row).some(Boolean));
}

function writeSheet(name, headers, rows) {
  state.workbook.Sheets[name] = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => headers.map((h) => row[h] || ''))
  ]);
  if (!state.workbook.SheetNames.includes(name)) {
    state.workbook.SheetNames.push(name);
  }
}

function normalizeLoadedData() {
  state.instruments.forEach((item) => {
    item.id = String(item.id || '');
    item.condition = normalizeCondition(item.condition);
  });
  state.users.forEach((user) => {
    user.role = user.role === 'admin' ? 'admin' : 'employee';
  });
}

export function normalizeCondition(value) {
  const v = String(value || '').toLowerCase();
  if (['busy','занят'].includes(v)) return 'busy';
  if (['retired','broken','списан'].includes(v)) return 'retired';
  return 'free';
}
