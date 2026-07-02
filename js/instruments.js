import { state } from './state.js';
import { $, escapeAttr, escapeHtml, formData, today } from './utils.js';
import { closeModal, field, input, openModal, select, toast } from './ui.js';
import { normalizeCondition, saveWorkbook } from './excel.js';
import { addHistoryEntry, closeHistoryEntry } from './history.js';

// ========== Вспомогательные ==========

export function nextId() {
  const ids = state.instruments.map((i) => Number(i.id)).filter((id) => Number.isFinite(id) && id > 0).sort((a, b) => a - b);
  let id = 1;
  for (const n of ids) {
    if (n === id) id++;
    else if (n > id) break;
  }
  return String(id);
}

export function sortInstruments() {
  state.instruments.sort((a, b) => Number(a.id) - Number(b.id));
}

export function verificationState(dateText) {
  if (!dateText) return 'none';
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return 'none';
  date.setHours(23, 59, 59, 999);
  return date >= new Date() ? 'valid' : 'expired';
}

export function verificationText(dateText) {
  return { valid: 'Поверен', expired: 'Не поверен', none: 'Без поверки' }[verificationState(dateText)];
}

export function verificationBadge(dateText) {
  return { valid: 'ok', expired: 'warn', none: 'muted' }[verificationState(dateText)];
}

export function conditionText(value) {
  return { free: 'Свободен', busy: 'Занят', retired: 'Списан' }[normalizeCondition(value)];
}

export function conditionBadge(value) {
  return { free: 'ok', busy: 'warn', retired: 'bad' }[normalizeCondition(value)];
}

// ========== Фильтрация и отрисовка списка ==========

export function filteredInstruments() {
  const q = state.search.trim().toLowerCase();
  return state.instruments.filter((i) => {
    const search = !q || [i.name, i.serial_number, i.model].some((v) => String(v || '').toLowerCase().includes(q));
    return search &&
      (state.verification === 'all' || verificationState(i.valid_until) === state.verification) &&
      (state.condition === 'all' || normalizeCondition(i.condition) === state.condition);
  });
}

export function renderRow(item) {
  return `<a class="row panel" href="?id=${escapeAttr(item.id)}" data-open-id="${escapeAttr(item.id)}">
    <div>
      <div class="row-title">#${escapeHtml(item.id)} ${escapeHtml(item.name || 'Без названия')}</div>
      <div class="row-subtitle">${escapeHtml(item.model || 'Модель не указана')} · ${escapeHtml(item.serial_number || 'Серийный номер не указан')}</div>
    </div>
    <div class="badges">
      <span class="badge ${verificationBadge(item.valid_until)}">${verificationText(item.valid_until)}</span>
      <span class="badge ${conditionBadge(item.condition)}">${conditionText(item.condition)}</span>
    </div>
  </a>`;
}

export function renderRetiredRow(item) {
  const isAdmin = state.currentUser.role === 'admin';
  return `<div class="row panel">
    <div>
      <div class="row-title">#${escapeHtml(item.id)} ${escapeHtml(item.name || 'Без названия')}</div>
      <div class="row-subtitle">${escapeHtml(item.model || 'Модель не указана')} · ${escapeHtml(item.serial_number || 'Серийный номер не указан')}</div>
    </div>
    <div class="badges">
      ${isAdmin ? `<button class="secondary" data-open-retired-id="${escapeAttr(item.id)}">Открыть карточку</button><button class="primary" data-restore-id="${escapeAttr(item.id)}">Восстановить</button>` : ''}
    </div>
  </div>`;
}

export function renderList(openCard) {
  sortInstruments();
  const list = filteredInstruments();
  document.getElementById('instrumentList').innerHTML = list.length ? list.map(renderRow).join('') : '<div class="panel card">Нет приборов по выбранным условиям</div>';
  document.querySelectorAll('[data-open-id]').forEach((node) => node.onclick = (event) => {
    event.preventDefault();
    openCard(node.dataset.openId);
  });
}

// ========== Карточка прибора ==========

export function renderCard(id, goList) {
  let item = state.instruments.find((i) => String(i.id) === String(id));
  let isRetired = false;
  if (!item) {
    item = state.retired.find((i) => String(i.id) === String(id));
    isRetired = true;
  }
  document.getElementById('listScreen').classList.add('hidden');
  document.getElementById('cardScreen').classList.remove('hidden');
  if (!item) {
    document.getElementById('cardScreen').innerHTML = `<div class="panel card">Прибор не найден<div class="actions"><button class="secondary" data-back>К списку</button></div></div>`;
    document.getElementById('cardScreen').querySelector('[data-back]').onclick = goList;
    return;
  }
  const isAdmin = state.currentUser.role === 'admin';
  const isTaken = Boolean(item.taken_by);
  const isOwner = item.taken_by === state.currentUser.username;
  const isRetiredFlag = isRetired || item.condition === 'retired';

  let mainButtons = '';
  let adminButtons = '';

  if (isRetiredFlag) {
    // Для списанных приборов - только восстановить, копировать, редактировать
    mainButtons += '<button class="secondary" data-copy>Копировать</button>';
    if (isAdmin) {
      mainButtons += '<button class="primary" data-restore>Восстановить</button>';
      mainButtons += '<button class="secondary" data-edit>Редактировать</button>';
      adminButtons += '<button class="danger" data-delete>Удалить</button>';
    }
  } else {
    if (!isTaken) {
      mainButtons += '<button class="primary" data-issue>Взять</button>';
    } else if (isTaken && (isOwner || isAdmin)) {
      mainButtons += '<button class="primary" data-return>Вернуть</button>';
      if (isOwner) mainButtons += '<button class="secondary" data-transfer>Передать</button>';
    }
    mainButtons += '<button class="secondary" data-qr>QR</button>';
    mainButtons += '<button class="secondary" data-copy>Копировать</button>';
    if (isAdmin) {
      mainButtons += '<button class="secondary" data-edit>Редактировать</button>';
    }
    if (isAdmin) {
      adminButtons += '<button class="danger" data-retire>Списать</button>';
      adminButtons += '<button class="danger" data-delete>Удалить</button>';
    }
  }

  const backButton = '<button class="secondary" data-back>К списку</button>';

  let actionsHtml = '';
  if (mainButtons) {
    actionsHtml += `<div class="actions" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">${mainButtons}</div>`;
  }
  if (adminButtons) {
    actionsHtml += `<div class="actions" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px;">${adminButtons}<span style="flex:1"></span>${backButton}</div>`;
  } else {
    actionsHtml += `<div class="actions" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px; justify-content:flex-end;">${backButton}</div>`;
  }

  document.getElementById('cardScreen').innerHTML =
    `<article class="panel card">
      <h1>${escapeHtml(item.name || 'Без названия')}</h1>
      <div class="badges">
        <span class="badge ${verificationBadge(item.valid_until)}">${verificationText(item.valid_until)}</span>
        <span class="badge ${conditionBadge(item.condition)}">${conditionText(item.condition)}</span>
      </div>
      <div class="card-grid">
        ${field('ID', item.id)}
        ${field('Серийный номер', item.serial_number)}
        ${field('Модель', item.model)}
        ${field('Тип', item.type)}
        ${field('Дата поверки/калибровки', item.verification_date)}
        ${field('Действительно до', item.valid_until)}
        ${field('Документ', item.document_url ? `<a href="${escapeAttr(item.document_url)}" target="_blank" rel="noopener">Открыть</a>` : '—', true)}
      </div>
      ${isTaken ? `<div class="issued">${field('Кто взял', item.taken_by)}${field('Место', item.taken_where)}${field('Доп.данные', item.taken_extra)}${field('Дата выдачи', item.taken_date)}</div>` : ''}
      ${actionsHtml}
    </article>`;

  bindCardActions(item, goList, isRetiredFlag);
}

function bindCardActions(item, goList, isRetired) {
  const root = document.getElementById('cardScreen');
  const b = (s, fn) => {
    const n = root.querySelector(s);
    if (n) n.onclick = fn;
  };
  b('[data-back]', goList);
  b('[data-issue]', () => showTakeForm(item));
  b('[data-return]', () => returnInstrument(item));
  b('[data-transfer]', () => showTransferForm(item));
  b('[data-edit]', () => showInstrumentForm(item));
  b('[data-retire]', () => retireInstrument(item, goList));
  b('[data-restore]', () => restoreRetiredItem(item, goList));
  b('[data-delete]', () => deleteInstrument(item, goList));
  b('[data-qr]', () => showQr(item));
  b('[data-copy]', () => copyInfo(item));
}

// ========== Форма добавления/редактирования прибора ==========

export function showInstrumentForm(item = null) {
  const isEdit = Boolean(item);
  const v = item || { id: nextId(), condition: 'free', type: 'Поверка', taken_extra: '' };
  openModal(isEdit ? 'Редактировать прибор' : 'Добавить прибор',
    `<form id="instrumentForm" class="form-grid">
      ${input('id', 'ID', v.id, 'number', true)}
      ${input('name', 'Название', v.name, 'text', true)}
      ${input('serial_number', 'Серийный номер', v.serial_number)}
      ${input('model', 'Модель', v.model)}
      ${select('type', 'Тип', v.type, ['Поверка', 'Калибровка'])}
      ${input('verification_date', 'Дата поверки/калибровки', v.verification_date, 'date')}
      ${input('valid_until', 'Действительно до', v.valid_until, 'date')}
      ${input('document_url', 'Ссылка на документ', v.document_url, 'url')}
      ${select('condition', 'Состояние', v.condition, [['free', 'Свободен'], ['busy', 'Занят'], ['retired', 'Списан']])}
      ${isEdit ? input('taken_extra', 'Доп. данные при выдаче', v.taken_extra || '', 'text') : ''}
      <div class="modal-actions"><button class="primary" type="submit">Сохранить</button></div>
    </form>`);

  document.getElementById('instrumentForm').onsubmit = async (event) => {
    event.preventDefault();
    const data = formData(event.target);
    data.condition = normalizeCondition(data.condition);
    if (!isEdit && state.instruments.some((row) => String(row.id) === String(data.id))) return toast('Такой ID уже есть', true);
    if (isEdit) Object.assign(item, data);
    else state.instruments.push(data);
    closeModal();
    await saveWorkbook('Прибор сохранен');
    location.search = '?id=' + encodeURIComponent(data.id);
  };
}

// ========== ВЗЯТЬ ПРИБОР (с подстановкой extra из профиля) ==========

function showTakeForm(item) {
  const userExtra = state.currentUser?.extra || '';

  openModal('Взять прибор',
    `<form id="takeForm" class="form-grid">
      <div class="field">
        <div class="field-label">Кто берет</div>
        <div class="field-value">${escapeHtml(state.currentUser.username)}</div>
      </div>
      ${input('taken_where', 'Место использования', item.taken_where)}
      ${input('taken_extra', 'Доп. данные (из профиля)', userExtra, 'text')}
      ${input('taken_date', 'Дата', today(), 'date')}
      <div class="modal-actions"><button class="primary" type="submit">Взять</button></div>
    </form>`);

  document.getElementById('takeForm').onsubmit = async (event) => {
    event.preventDefault();
    const data = formData(event.target);
    Object.assign(item, data, {
      taken_by: state.currentUser.username,
      condition: 'busy'
    });
    addHistoryEntry(item);
    closeModal();
    await saveWorkbook('Прибор взят');
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

// ========== ВОЗВРАТ (очищаем taken_extra) ==========

async function returnInstrument(item) {
  item.condition = 'free';
  closeHistoryEntry(item, state.currentUser.username);
  item.taken_by = '';
  item.taken_where = '';
  item.taken_extra = '';
  item.taken_date = '';
  await saveWorkbook('Прибор возвращен');
  window.dispatchEvent(new Event('app:refresh-route'));
}

// ========== ПЕРЕДАЧА (редактируем taken_extra) ==========

function showTransferForm(item) {
  openModal('Передать прибор',
    `<form id="transferForm" class="form-grid">
      ${select('taken_by', 'Новый пользователь', '', state.users.filter((u) => u.username !== item.taken_by).map((u) => [u.username, u.username]))}
      ${input('taken_where', 'Место использования', item.taken_where)}
      ${input('taken_extra', 'Доп. данные', item.taken_extra || '')}
      <div class="modal-actions"><button class="primary" type="submit">Передать</button></div>
    </form>`);

  document.getElementById('transferForm').onsubmit = async (event) => {
    event.preventDefault();
    closeHistoryEntry(item, state.currentUser.username);
    const data = formData(event.target);
    Object.assign(item, data, { taken_date: today(), condition: 'busy' });
    addHistoryEntry(item);
    closeModal();
    await saveWorkbook('Прибор передан');
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

// ========== СПИСАТЬ (с добавлением 0 к ID) ==========

async function retireInstrument(item, goList) {
  if (!confirm('Списать прибор?')) return;
  closeHistoryEntry(item, state.currentUser.username);
  let newId = String(item.id);
  if (!newId.startsWith('0')) {
    newId = '0' + newId;
  }
  const retiredItem = {
    ...item,
    id: newId,
    condition: 'retired',
    retired_date: today()
  };
  state.retired.push(retiredItem);
  state.instruments = state.instruments.filter((row) => row !== item);
  await saveWorkbook('Прибор списан');
  goList();
}

// ========== ВОССТАНОВИТЬ ==========

export async function restoreRetiredItem(item, goList) {
  if (!confirm('Восстановить прибор из списанных?')) return;
  let originalId = String(item.id);
  if (originalId.startsWith('0')) {
    originalId = originalId.slice(1);
  }
  let newId = originalId;
  if (state.instruments.some((row) => String(row.id) === newId)) {
    newId = nextId();
  }
  state.retired = state.retired.filter((row) => row !== item);
  const restored = {
    ...item,
    id: newId,
    condition: 'free',
    taken_by: '',
    taken_where: '',
    taken_extra: '',
    taken_date: ''
  };
  delete restored.retired_date;
  state.instruments.push(restored);
  await saveWorkbook('Прибор восстановлен');
  if (goList) goList();
  else window.dispatchEvent(new Event('app:refresh-route'));
}

// ========== УДАЛИТЬ (активный или списанный) ==========

async function deleteInstrument(item, goList) {
  console.log('=== deleteInstrument вызвана ===');
  console.log('item:', item);
  console.log('state.retired:', state.retired);
  
  // Проверяем, есть ли прибор в списанных (по ссылке)
  const isRetiredByRef = state.retired.some((i) => i === item);
  // Также проверим по ID и condition
  const isRetiredById = state.retired.some((i) => String(i.id) === String(item.id));
  const isRetiredByCondition = item.condition === 'retired';
  
  console.log('isRetiredByRef:', isRetiredByRef);
  console.log('isRetiredById:', isRetiredById);
  console.log('isRetiredByCondition:', isRetiredByCondition);
  
  const isRetired = isRetiredByRef || isRetiredById || isRetiredByCondition;
  
  if (!confirm('Удалить прибор без возможности восстановления?')) return;
  
  if (isRetired) {
    console.log('Удаляем из списанных');
    state.retired = state.retired.filter((i) => String(i.id) !== String(item.id));
    console.log('После удаления state.retired:', state.retired);
    
    // Закрываем модалку, если она открыта
    const modal = document.getElementById('modal');
    if (modal && modal.open) modal.close();
    
    await saveWorkbook('Прибор удалён из списанных');
    console.log('Сохранено, переходим к списку');
    goList();
  } else {
    console.log('Удаляем из активных');
    state.instruments = state.instruments.filter((i) => String(i.id) !== String(item.id));
    await saveWorkbook('Прибор удалён');
    goList();
  }
}

// ========== QR и КОПИРОВАНИЕ ==========

function showQr(item) {
  const url = location.origin + location.pathname + '?id=' + encodeURIComponent(item.id);
  openModal('QR-код',
    `<div id="qrBox"></div><p>${escapeHtml(item.name)}</p>
    <div class="modal-actions"><button class="primary" data-download-qr>Скачать</button></div>`);
  new QRCode(document.getElementById('qrBox'), { text: url, width: 220, height: 220 });
  document.querySelector('[data-download-qr]').onclick = () => downloadQr(item);
}

function downloadQr(item) {
  const box = document.getElementById('qrBox');
  const canvas = box.querySelector('canvas');
  const img = box.querySelector('img');
  const href = canvas ? canvas.toDataURL('image/png') : img ? img.src : '';
  if (!href) return toast('QR-код еще не готов', true);
  const a = document.createElement('a');
  a.href = href;
  a.download = 'qr-' + (item.id || 'instrument') + '.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copyInfo(item) {
  await navigator.clipboard.writeText(
    ['Название: ' + (item.name || '—'),
     'Серийный номер: ' + (item.serial_number || '—'),
     'Модель: ' + (item.model || '—'),
     'Тип: ' + (item.type || '—'),
     'Действительно до: ' + (item.valid_until || '—'),
     'Документ: ' + (item.document_url || '—')].join('\n')
  );
  toast('Информация скопирована');
}
