import { state } from './state.js';
import { $ } from './utils.js';
import { loadWorkbook } from './excel.js';
import { ensureDefaultAdmin, login, logout, readSession, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm } from './instruments.js';
import { showCalendar } from './calendar.js';
import { renderRow } from './instruments.js';
import { openModal, toast } from './ui.js';
document.addEventListener('DOMContentLoaded', init);
async function init() { bindEvents(); state.currentUser = readSession(); try { await loadWorkbook(); await ensureDefaultAdmin(); state.currentUser ? showApp() : showAuth(); } catch (error) { toast(error.message, true); $('authView').innerHTML = '<div class="panel card">Ошибка загрузки: ' + error.message + '</div>'; } }
function bindEvents() { $('loginForm').addEventListener('submit', onLogin); $('logoutButton').onclick = () => { logout(); history.pushState(null, '', location.pathname); showAuth(); }; $('usersButton').onclick = showUsersManager; $('profileButton').onclick = () => showUserForm(state.users.find((u) => u.username === state.currentUser.username), showApp); $('addInstrumentButton').onclick = () => showInstrumentForm(); $('calendarButton').onclick = showCalendar; $('retiredButton').onclick = showRetired; $('searchInput').oninput = (e) => { state.search = e.target.value; renderList(openCard); }; $('verificationFilter').onchange = (e) => { state.verification = e.target.value; renderList(openCard); }; $('conditionFilter').onchange = (e) => { state.condition = e.target.value; renderList(openCard); }; window.addEventListener('popstate', renderRoute); window.addEventListener('app:refresh-route', renderRoute); }
function onLogin(event) { event.preventDefault(); if (!login($('loginUsername').value.trim(), $('loginPassword').value)) return toast('Неверный логин или пароль', true); showApp(); }
function showAuth() { $('authView').classList.remove('hidden'); $('appView').classList.add('hidden'); }
function showApp() { $('authView').classList.add('hidden'); $('appView').classList.remove('hidden'); $('currentUserBadge').textContent = state.currentUser.role === 'admin' ? 'Администратор' : state.currentUser.username; document.querySelectorAll('.admin-only').forEach((node) => node.classList.toggle('hidden', state.currentUser.role !== 'admin')); renderRoute(); }
function renderRoute() { const id = new URLSearchParams(location.search).get('id'); if (id) renderCard(id, goList); else { $('cardScreen').classList.add('hidden'); $('listScreen').classList.remove('hidden'); renderList(openCard); } }
function openCard(id) { history.pushState(null, '', '?id=' + encodeURIComponent(id)); renderRoute(); }
function goList() { history.pushState(null, '', location.pathname); renderRoute(); }
function showRetired() { const html = state.retired.length ? state.retired.map(renderRow).join('') : '<div class="panel card">Списанных приборов нет</div>'; openModal('Списанные приборы', '<div class="list">' + html + '</div><div class="modal-actions"><button class="secondary" data-close>Закрыть</button></div>'); }
