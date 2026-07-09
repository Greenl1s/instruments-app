import { CONFIG } from './config.js';
import { state } from './state.js';

const SUPABASE_URL = CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = CONFIG.supabaseAnonKey;

/**
 * Выполняет запрос к Supabase REST API
 */
async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error (${response.status}): ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

/**
 * Загружает все данные из Supabase
 */
export async function loadWorkbook() {
  console.log('[Supabase] Загрузка данных...');
  try {
    const [instruments, history, users, retired] = await Promise.all([
      supabaseFetch('instruments?select=*'),
      supabaseFetch('history?select=*'),
      supabaseFetch('users?select=*'),
      supabaseFetch('retired?select=*')
    ]);
    return { instruments, history, users, retired };
  } catch (err) {
    throw new Error(`Ошибка загрузки данных из Supabase: ${err.message}`);
  }
}

/**
 * Сохраняет все данные в Supabase (upsert)
 */
export async function saveWorkbook(message = 'Сохранено') {
  console.log('[Supabase] Сохранение данных...');
  try {
    const { instruments, history, users, retired } = state;
    
    // Сохраняем каждую таблицу
    await upsertData('instruments', instruments, 'id');
    await upsertData('history', history, 'id');
    await upsertData('users', users, 'username');
    await upsertData('retired', retired, 'id');
    
    return message;
  } catch (err) {
    throw new Error(`Ошибка сохранения данных: ${err.message}`);
  }
}

/**
 * Обновляет или вставляет записи (upsert)
 */
async function upsertData(table, records, primaryKey) {
  if (!records || records.length === 0) return;
  
  // Для каждой записи делаем отдельный запрос (можно и batch, но так проще)
  for (const record of records) {
    // Проверяем, существует ли запись с таким primaryKey
    const existing = await supabaseFetch(`${table}?${primaryKey}=eq.${record[primaryKey]}`);
    if (existing && existing.length > 0) {
      // Обновляем
      await supabaseFetch(`${table}?${primaryKey}=eq.${record[primaryKey]}`, {
        method: 'PATCH',
        body: JSON.stringify(record)
      });
    } else {
      // Вставляем
      await supabaseFetch(table, {
        method: 'POST',
        body: JSON.stringify(record)
      });
    }
  }
}
