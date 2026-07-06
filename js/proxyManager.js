import { CONFIG } from './config.js';

export const PROXY_DOMAINS = [
  'https://prox-cstroy.vercel.app',
  'https://prox-cstroy-git-main-greenlts-projects.vercel.app',
  'https://prox-cstroy-530uik1l-greenlts-projects.vercel.app'
];

const TIMEOUT_MS = 15000; // 15 секунд таймаут

/**
 * Проверяет доступность одного прокси-домена через HEAD-запрос к /download
 */
async function checkProxyAvailable(baseUrl) {
  const url = baseUrl.replace(/\/+$/, '') + '/download?public_key=' + encodeURIComponent(CONFIG.publicKey);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(url, {
      method: 'HEAD', // HEAD-запрос быстрее, не скачивает тело
      signal: controller.signal
    });
    clearTimeout(timeout);
    // Считаем доступным, если статус 200-499 (не ошибка соединения)
    return response.ok || response.status < 500;
  } catch (error) {
    // Ошибка сети или таймаут – считаем недоступным
    return false;
  }
}

/**
 * Возвращает первый доступный прокси-домен из списка.
 * Если все недоступны – возвращает первый из списка (как fallback).
 */
export async function getAvailableProxyUrl() {
  // Проверяем домены последовательно (можно параллельно, но тогда много запросов)
  for (const domain of PROXY_DOMAINS) {
    const available = await checkProxyAvailable(domain);
    if (available) {
      console.log('[ProxyManager] Используем домен:', domain);
      return domain;
    }
  }
  // Если ни один не ответил – возвращаем первый (будет ошибка, но хоть что-то)
  console.warn('[ProxyManager] Все прокси недоступны, используем первый по списку');
  return PROXY_DOMAINS[0];
}
