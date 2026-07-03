import { state } from './state.js';
import { $ } from './utils.js';
import { loadWorkbook } from './excel.js';
import { ensureDefaultAdmin, login, logout, readSession, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm, renderRetiredRow, restoreRetiredItem } from './instruments.js';
import { showCalendar } from './calendar.js';
import { openModal, toast, closeModal } from './ui.js';

// ============================================================
// Кнопка переключения темы (фиксированная, с псевдо-элементами)
// ============================================================
const themeToggle = document.getElementById('themeToggle');

if (themeToggle) {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
  }

  themeToggle.addEventListener('click', () => {
    themeToggle.classList.add('switching');
    setTimeout(() => themeToggle.classList.remove('switching'), 600);
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
} else {
  console.warn('Кнопка переключения темы не найдена в DOM');
}

// ============================================================
// Спиннер для кнопок (внутренняя функция, не экспортируется)
// ============================================================
function showSpinner(button) {
  if (!button || button.disabled) return null;
  button.disabled = true;
  const originalHtml = button.innerHTML;
  button.dataset.originalHtml = originalHtml;
  button.innerHTML = '<span class="spinner"></span> Загрузка...';
  return function restore() {
    button.disabled = false;
    button.innerHTML = button.dataset.originalHtml || originalHtml;
    delete button.dataset.originalHtml;
  };
}

// ============================================================
// Инициализация
// ============================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  state.currentUser = readSession();
  try {
    await loadWorkbook();
    await ensureDefaultAdmin();
    state.currentUser ? showApp() : showAuth();
  } catch (error) {
    toast(error.message, true);
    document.getElementById('authView').innerHTML = `<div class="panel card">Ошибка загрузки: ${error.message}</div>`;
  }
}

// ============================================================
// Привязка событий
// ============================================================
function bindEvents() {
  document.getElementById('loginForm').addEventListener('submit', onLogin);

  document.getElementById('logoutButton').onclick = () => {
    logout();
    history.pushState(null, '', location.pathname);
    showAuth();
  };
  document.getElementById('usersButton').onclick = showUsersManager;
  document.getElementById('profileButton').onclick = () =>
    showUserForm(
      state.users.find((u) => u.username === state.currentUser.username),
      showApp
    );

  document.getElementById('addInstrumentButton').onclick = () => showInstrumentForm();
  document.getElementById('calendarButton').onclick = () => {
    if (state.currentUser.role !== 'admin') {
      toast('Доступ запрещён', true);
      return;
    }
    showCalendar();
  };
  document.getElementById('retiredButton').onclick = showRetired;

  document.getElementById('searchInput').oninput = (e) => {
    state.search = e.target.value;
    renderList(openCard);
  };
  document.getElementById('verificationFilter').onchange = (e) => {
    state.verification = e.target.value;
    renderList(openCard);
  };
  document.getElementById('conditionFilter').onchange = (e) => {
    state.condition = e.target.value;
    renderList(openCard);
  };

  window.addEventListener('popstate', renderRoute);
  window.addEventListener('app:refresh-route', renderRoute);
}

// ============================================================
// Вход (со спиннером)
// ============================================================
async function onLogin(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  const restore = showSpinner(btn);
  if (!restore) return;

  try {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!login(username, password)) {
      toast('Неверный логин или пароль', true);
      restore();
      return;
    }
    showApp();
    restore();
  } catch (err) {
    toast('Ошибка входа', true);
    restore();
  }
}

// ============================================================
// Переключение экранов
// ============================================================
function showAuth() {
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('appView').classList.add('hidden');
}

function showApp() {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.getElementById('currentUserBadge').textContent =
    state.currentUser.role === 'admin' ? 'Администратор' : state.currentUser.username;
  document.querySelectorAll('.admin-only').forEach((node) =>
    node.classList.toggle('hidden', state.currentUser.role !== 'admin')
  );
  renderRoute();
}

// ============================================================
// Маршрутизация
// ============================================================
function renderRoute() {
  const id = new URLSearchParams(location.search).get('id');
  if (id) {
    renderCard(id, goList);
  } else {
    document.getElementById('cardScreen').classList.add('hidden');
    document.getElementById('listScreen').classList.remove('hidden');
    renderList(openCard);
  }
}

function openCard(id) {
  history.pushState(null, '', `?id=${encodeURIComponent(id)}`);
  renderRoute();
}

function goList() {
  history.pushState(null, '', location.pathname);
  renderRoute();
}

// ============================================================
// Списанные приборы
// ============================================================
function showRetired() {
  const isAdmin = state.currentUser.role === 'admin';
  let html = '';
  if (!state.retired.length) {
    html = '<div class="panel card">Списанных приборов нет</div>';
  } else {
    html = state.retired.map(renderRetiredRow).join('');
  }
  openModal('Списанные приборы', `<div class="list">${html}</div>`);

  if (!isAdmin) return;

  document.querySelectorAll('[data-restore-id]').forEach((btn) => {
    btn.onclick = async (e) => {
      const id = btn.dataset.restoreId;
      const item = state.retired.find((i) => String(i.id) === String(id));
      if (!item) return toast('Прибор не найден', true);
      await restoreRetiredItem(item);
      showRetired();
    };
  });

  document.querySelectorAll('[data-open-retired-id]').forEach((btn) => {
    btn.onclick = (e) => {
      const id = btn.dataset.openRetiredId;
      closeModal();
      openCard(id);
    };
  });
}
