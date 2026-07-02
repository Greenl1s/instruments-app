import { state } from './state.js';
import { $ } from './utils.js';
import { loadWorkbook } from './excel.js';
import { ensureDefaultAdmin, login, logout, readSession, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm, renderRetiredRow, restoreRetiredItem } from './instruments.js';
import { showCalendar } from './calendar.js';
import { openModal, toast, closeModal } from './ui.js';

// Для отладки – сделаем closeModal глобальной
window.closeModal = closeModal;

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
    $('authView').innerHTML = '<div class="panel card">Ошибка загрузки: ' + error.message + '</div>';
  }
}

function bindEvents() {
  $('loginForm').addEventListener('submit', onLogin);
  $('logoutButton').onclick = () => {
    logout();
    history.pushState(null, '', location.pathname);
    showAuth();
  };
  $('usersButton').onclick = showUsersManager;
  $('profileButton').onclick = () => showUserForm(state.users.find((u) => u.username === state.currentUser.username), showApp);
  $('addInstrumentButton').onclick = () => showInstrumentForm();
  $('calendarButton').onclick = () => {
  if (state.currentUser && state.currentUser.role !== 'admin') {
    toast('Доступ запрещён', true);
    return;
  }
  showCalendar();
};
  $('retiredButton').onclick = showRetired;
  $('searchInput').oninput = (e) => {
    state.search = e.target.value;
    renderList(openCard);
  };
  $('verificationFilter').onchange = (e) => {
    state.verification = e.target.value;
    renderList(openCard);
  };
  $('conditionFilter').onchange = (e) => {
    state.condition = e.target.value;
    renderList(openCard);
  };
  window.addEventListener('popstate', renderRoute);
  window.addEventListener('app:refresh-route', renderRoute);
}

function onLogin(event) {
  event.preventDefault();
  if (!login($('loginUsername').value.trim(), $('loginPassword').value)) return toast('Неверный логин или пароль', true);
  showApp();
}

function showAuth() {
  $('authView').classList.remove('hidden');
  $('appView').classList.add('hidden');
}

function showApp() {
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('currentUserBadge').textContent = state.currentUser.role === 'admin' ? 'Администратор' : state.currentUser.username;
  document.querySelectorAll('.admin-only').forEach((node) => node.classList.toggle('hidden', state.currentUser.role !== 'admin'));
  renderRoute();
}

function renderRoute() {
  const id = new URLSearchParams(location.search).get('id');
  if (id) renderCard(id, goList);
  else {
    $('cardScreen').classList.add('hidden');
    $('listScreen').classList.remove('hidden');
    renderList(openCard);
  }
}

function openCard(id) {
  history.pushState(null, '', '?id=' + encodeURIComponent(id));
  renderRoute();
}

function goList() {
  history.pushState(null, '', location.pathname);
  renderRoute();
}

function showRetired() {
  const isAdmin = state.currentUser.role === 'admin';
  let html = '';
  if (!state.retired.length) {
    html = '<div class="panel card">Списанных приборов нет</div>';
  } else {
    html = state.retired.map(renderRetiredRow).join('');
  }
  openModal('Списанные приборы', '<div class="list">' + html + '</div>');
  if (isAdmin) {
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
        // Закрываем модалку напрямую через DOM
        const modal = document.getElementById('modal');
        if (modal) modal.close();
        // Также вызываем closeModal на случай, если она определена
        if (typeof closeModal === 'function') closeModal();
        openCard(id);
      };
    });
  }
}
