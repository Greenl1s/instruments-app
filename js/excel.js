import { CONFIG, HEADERS, SHEETS } from './config.js';
import { state } from './state.js';
import { clean } from './utils.js';
import { setSync } from './ui.js';

function apiUrl(path) {
  return CONFIG.proxyUrl.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

export async function loadWorkbook() {
  console.log('[loadWorkbook] Начинаем загрузку');
  setSync('Загрузка файла...');
  const url = apiUrl('/download?public_key=' + encodeURIComponent(CONFIG.publicKey));
  console.log('[loadWorkbook] URL запроса:', url);
  const response = await fetch(url);
  console.log('[loadWorkbook] Статус ответа:', response.status);
  if (!response.ok) throw new Error('Не удалось загрузить Excel-файл: ' + response.status);

  const arrayBuffer = await response.arrayBuffer();
  console.log('[loadWorkbook] Размер файла:', arrayBuffer.byteLength, 'байт');

  state.workbook = XLSX.read(arrayBuffer, { type: 'array' });
  console.log('[loadWorkbook] Листы:', state.workbook.SheetNames);

  state.instruments = readSheet(SHEETS.instruments, HEADERS.instruments);
  state.history = readSheet(SHEETS.history, HEADERS.history);
  state.users = readSheet(SHEETS.users, HEADERS.users);
  state.retired = readSheet(SHEETS.retired, HEADERS.retired);
  console.log('[loadWorkbook] Загружено приборов:', state.instruments.length);
  console.log('[loadWorkbook] Загружено пользователей:', state.users.length);

  normalizeLoadedData();
  setSync('Файл загружен');
  console.log('[loadWorkbook] Загрузка завершена');
}

export async function saveWorkbook(message = 'Сохранено') {
  console.log('[saveWorkbook] Начинаем сохранение');
  setSync('Сохранение...');

  writeSheet(SHEETS.instruments, HEADERS.instruments, state.instruments);
  writeSheet(SHEETS.history, HEADERS.history, state.history);
  writeSheet(SHEETS.users, HEADERS.users, state.users);
  writeSheet(SHEETS.retired, HEADERS.retired, state.retired);

  console.log('[saveWorkbook] Листы записаны');
  const wbout = XLSX.write(state.workbook, { bookType: 'xlsx', type: 'array' });
  console.log('[saveWorkbook] Размер данных для загрузки:', wbout.length, 'байт');

  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = apiUrl('/upload');
  console.log('[saveWorkbook] Отправка PUT на:', url);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Write-Secret': CONFIG.writeSecret
    },
    body: blob
  });

  console.log('[saveWorkbook] Статус ответа:', response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[saveWorkbook] Ошибка:', errorText);
    throw new Error('Не удалось сохранить Excel-файл: ' + response.status + ' ' + errorText);
  }

  if (response.status === 204) {
    console.log('[saveWorkbook] Сохранение успешно (204)');
    setSync(message);
    return;
  }

  try {
    const result = await response.json();
    console.log('[saveWorkbook] Ответ сервера:', result);
  } catch (e) {
    if (response.ok) {
      console.log('[saveWorkbook] Сохранение успешно (не JSON ответ)');
    } else {
      throw e;
    }
  }
  setSync(message);
  console.log('[saveWorkbook] Сохранение завершено');
}

function readSheet(name, headers) {
  console.log('[readSheet] Чтение листа:', name);
  const sheet = state.workbook.Sheets[name];
  if (!sheet) {
    console.log('[readSheet] Лист', name, 'не найден');
    return [];
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) {
    console.log('[readSheet] Лист', name, 'пустой');
    return [];
  }
  const first = rows[0].map((c) => String(c).trim());
  const hasHeaders = headers.every((h) => first.includes(h));
  const sourceHeaders = hasHeaders ? first : headers;
  const dataRows = hasHeaders ? rows.slice(1) : rows;
  console.log('[readSheet] Найдено строк:', dataRows.length);
  return dataRows.map((row) =>
    Object.fromEntries(sourceHeaders.map((h, i) => [h, clean(row[i])]))
  ).filter((row) => Object.values(row).some(Boolean));
}

function writeSheet(name, headers, rows) {
  console.log('[writeSheet] Запись листа:', name, 'строк:', rows.length);
  state.workbook.Sheets[name] = XLSX.utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => headers.map((h) => row[h] || ''))
  ]);
  if (!state.workbook.SheetNames.includes(name)) {
    state.workbook.SheetNames.push(name);
  }
}

function normalizeLoadedData() {
  console.log('[normalizeLoadedData] Нормализация данных');
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
