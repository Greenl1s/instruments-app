import { state } from './state.js';
import { $ } from './utils.js';
import { loadWorkbook, saveWorkbook } from './supabase.js';  // ← вместо excel.js
import { ensureDefaultAdmin, login, logout, readSession, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm, renderRetiredRow, restoreRetiredItem, retireInstrument } from './instruments.js';
import { showCalendar } from './calendar.js';
import { openModal, toast, closeModal } from './ui.js';

// ===== Переключение темы =====
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = 'Светлая';
  } else {
    themeToggle.textContent = 'Тёмная';
  }
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? 'Светлая' : 'Тёмная';
  });
}

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  state.currentUser = readSession();
  try {
    const data = await loadWorkbook();  // ← загружаем из Supabase
    state.instruments = data.instruments || [];
    state.history = data.history || [];
    state.users = data.users || [];
    state.retired = data.retired || [];
    
    await ensureDefaultAdmin(); // добавляем admin, если его нет
    populateUserFilter();
    state.currentUser ? showApp() : showAuth();
  } catch (error) {
    toast(error.message, true);
    document.getElementById('authView').innerHTML = `<div class="panel card">Ошибка загрузки: ${error.message}</div>`;
  }
}

// ... остальной код app.js без изменений (все функции bindEvents, onLogin, showApp, renderRoute, showRetired и т.д.)
// (они уже были даны в предыдущих ответах, просто скопируйте их сюда)
