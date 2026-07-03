import { state } from './state.js';
import { $ } from './utils.js';
import { loadWorkbook } from './excel.js';
import { ensureDefaultAdmin, login, logout, readSession, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm, renderRetiredRow, restoreRetiredItem } from './instruments.js';
import { showCalendar } from './calendar.js';
import { openModal, toast, closeModal } from './ui.js';

const themeToggle = document.getElementById('themeToggle');
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
  themeToggle.textContent = isDark ? 'Светлая' : 'Тёмная';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// ============================================================
// 2. Спиннер для кнопок (микро-взаимодействие)
// ============================================================
export function showSpinner(button) {
  if (!button || button.disabled) return null;
  button.disabled = true;
  const originalText = button.textContent;
  const originalHtml = button.innerHTML;
  button.dataset.originalText = originalText;
  button.dataset.originalHtml = originalHtml;
  button.innerHTML = '<span class="spinner"></span> Загрузка...';
  return function restore() {
    button.disabled = false;
    button.textContent = button.dataset.originalText || originalText;
    button.innerHTML = button.dataset.originalHtml || originalHtml;
    delete button.dataset.originalText;
    delete button.dataset.originalHtml;
  };
}

// ============================================================
// 3. Инициализация приложения
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
// 4. Привязка событий
// ============================================================
function bindEvents() {
  // Форма входа
  document.getElementById('loginForm').addEventListener('submit', onLogin);

  // Кнопки верхней панели
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

  // Кнопки тулбара
  document.getElementById('addInstrumentButton').onclick = () => showInstrumentForm();
  document.getElementById('calendarButton').onclick = () => {
    if (state.currentUser.role !== 'admin') {
      toast('Доступ запрещён', true);
      return;
    }
    showCalendar();
  };
  document.getElementById('retiredButton').onclick = showRetired;

  // Фильтры и поиск
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

  // Навигация (история и обновление)
  window.addEventListener('popstate', renderRoute);
  window.addEventListener('app:refresh-route', renderRoute);
}

// ============================================================
// 5. Авторизация (с показом спиннера)
// ============================================================
async function onLogin(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
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
// 6. Показать/скрыть экраны
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
// 7. Маршрутизация (список / карточка)
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
// 8. Модалка со списанными приборами
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

  // Восстановление
  document.querySelectorAll('[data-restore-id]').forEach((btn) => {
    btn.onclick = async (e) => {
      const id = btn.dataset.restoreId;
      const item = state.retired.find((i) => String(i.id) === String(id));
      if (!item) return toast('Прибор не найден', true);
      // Можно показать спиннер на кнопке, но здесь проще
      await restoreRetiredItem(item);
      showRetired(); // обновляем модалку
    };
  });

  // Открыть карточку
  document.querySelectorAll('[data-open-retired-id]').forEach((btn) => {
    btn.onclick = (e) => {
      const id = btn.dataset.openRetiredId;
      closeModal();
      openCard(id);
    };
  });
}
