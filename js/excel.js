import { CONFIG, HEADERS, SHEETS } from './config.js';
import { state } from './state.js';
import { clean } from './utils.js';
import { setSync } from './ui.js';

function apiUrl(path) {
  // Эта функция больше не нужна, но оставим для совместимости
  return CONFIG.proxyUrl.replace(/\/+$/, '');
}

export async function loadWorkbook() {
  setSync('Загрузка файла...');
  console.log('[loadWorkbook] Начинаем загрузку');
  
  // Формируем URL для API Яндекс.Диска
  const yandexApiUrl = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' + CONFIG.publicKey;
  
  // Формируем запрос к прокси
  const proxyBase = CONFIG.proxyUrl.replace(/\/+$/, '');
  // ВАЖНО: кодируем ТОЛЬКО один раз, не кодируем уже закодированное
  const requestUrl = proxyBase + '?url=' + encodeURIComponent(yandexApiUrl);
  
  console.log('[loadWorkbook] URL запроса:', requestUrl);
  
  const response = await fetch(requestUrl);
  console.log('[loadWorkbook] Статус ответа:', response.status);
  
  if (!response.ok) {
    throw new Error('Не удалось загрузить Excel-файл. Статус: ' + response.status);
  }
  
  const data = await response.json();
  // Скачиваем файл по полученной ссылке
  const fileResponse = await fetch(data.href);
  if (!fileResponse.ok) {
    throw new Error('Не удалось скачать файл. Статус: ' + fileResponse.status);
  }
  
  const blob = await fileResponse.blob();
  console.log('[loadWorkbook] Размер файла:', blob.size, 'байт');
  
  state.workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
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
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // Получаем ссылку для загрузки через прокси
  const proxyBase = CONFIG.proxyUrl.replace(/\/+$/, '');
  const uploadUrl = 'https://cloud-api.yandex.net/v1/disk/resources/upload?path=' + encodeURIComponent(CONFIG.filePath || '/Учёт.xlsx') + '&overwrite=true';
  const getUploadUrl = proxyBase + '?url=' + encodeURIComponent(uploadUrl);
  
  const uploadResponse = await fetch(getUploadUrl, {
    headers: { 'X-Write-Secret': CONFIG.writeSecret }
  });
  if (!uploadResponse.ok) {
    throw new Error('Не удалось получить ссылку для загрузки');
  }
  const data = await uploadResponse.json();
  if (!data.href) {
    throw new Error('Нет href для загрузки');
  }

  // Отправляем файл через прокси
  const putUrl = proxyBase + '?url=' + encodeURIComponent(data.href);
  const putResponse = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      'X-Write-Secret': CONFIG.writeSecret,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    body: blob
  });
  if (!putResponse.ok) {
    throw new Error('Не удалось сохранить Excel-файл');
  }

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
