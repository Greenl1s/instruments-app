import { state } from './state.js';
import { pad, escapeHtml } from './utils.js';
import { openModal, closeModal } from './ui.js';

export function showCalendar() {
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  function renderCalendar(y, m) {
    // Карта для поверок
    const verificationMap = new Map();
    state.instruments.forEach((item) => {
      if (!item.valid_until) return;
      if (!verificationMap.has(item.valid_until)) verificationMap.set(item.valid_until, []);
      verificationMap.get(item.valid_until).push(item);
    });

    // Карта для бронирований
    const bookedMap = new Map();
    state.instruments.forEach((item) => {
      if (!item.booked_by || !item.booked_date) return;
      if (!bookedMap.has(item.booked_date)) bookedMap.set(item.booked_date, []);
      bookedMap.get(item.booked_date).push(item);
    });

    // Карта для выдач (taken)
    const takenMap = new Map();
    state.instruments.forEach((item) => {
      if (!item.taken_by || !item.taken_date) return;
      if (!takenMap.has(item.taken_date)) takenMap.set(item.taken_date, []);
      takenMap.get(item.taken_date).push(item);
    });

    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const today = new Date();

    let grid = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      .map((d) => '<div class="day header">' + d + '</div>').join('');

    for (let i = 0; i < offset; i++) grid += '<div></div>';

    for (let d = 1; d <= days; d++) {
      const key = y + '-' + pad(m + 1) + '-' + pad(d);
      const verificationEvents = verificationMap.get(key) || [];
      const bookedEvents = bookedMap.get(key) || [];
      const takenEvents = takenMap.get(key) || [];
      
      const hasVerification = verificationEvents.length > 0;
      const hasBooked = bookedEvents.length > 0;
      const hasTaken = takenEvents.length > 0;
      
      const isToday = (y === today.getFullYear() && m === today.getMonth() && d === today.getDate());
      
      let classes = 'day';
      if (isToday) classes += ' today';
      
      // Определяем цвет
      let eventType = '';
      if (hasVerification && hasBooked && hasTaken) {
        classes += ' all'; // фиолетовый
        eventType = 'all';
      } else if ((hasVerification && hasBooked) || (hasVerification && hasTaken) || (hasBooked && hasTaken)) {
        classes += ' mixed'; // оранжевый
        eventType = 'mixed';
      } else if (hasBooked) {
        classes += ' booked'; // красный
        eventType = 'booked';
      } else if (hasTaken) {
        classes += ' taken'; // синий
        eventType = 'taken';
      } else if (hasVerification) {
        classes += ' event'; // зелёный
        eventType = 'verification';
      }
      
      let click = '';
      if (hasVerification || hasBooked || hasTaken) {
        const dateStr = key;
        click = `onclick="window._showDayEvents('${dateStr}')"`;
      }
      
      // Подсказка при наведении
      let titleParts = [];
      if (hasVerification) titleParts.push('Поверка: ' + verificationEvents.map(i => i.name).join(', '));
      if (hasBooked) titleParts.push('Бронь: ' + bookedEvents.map(i => i.name + ' (' + i.booked_by + ')').join(', '));
      if (hasTaken) titleParts.push('Выдано: ' + takenEvents.map(i => i.name + ' (' + i.taken_by + ')').join(', '));
      
      grid += `<div class="${classes}" ${click} title="${titleParts.join('; ')}">${d}</div>`;
    }
    return grid;
  }

  // Глобальная функция для показа событий дня
  window._showDayEvents = (dateStr) => {
    const verificationEvents = state.instruments.filter(i => i.valid_until === dateStr);
    const bookedEvents = state.instruments.filter(i => i.booked_date === dateStr && i.booked_by);
    const takenEvents = state.instruments.filter(i => i.taken_date === dateStr && i.taken_by);

    let html = '<div class="day-events">';
    
    if (takenEvents.length) {
      html += `<h3>Выданы:</h3>`;
      takenEvents.forEach(item => {
        html += `<div class="row panel" style="cursor:pointer;" onclick="window._openInstrument('${item.id}')">
          <span>#${escapeHtml(item.id)} ${escapeHtml(item.name)}</span>
          <span class="badge ok">Выдача: ${escapeHtml(item.taken_by)}</span>
        </div>`;
      });
    }
    
    if (bookedEvents.length) {
      html += `<h3>Бронирование:</h3>`;
      bookedEvents.forEach(item => {
        html += `<div class="row panel" style="cursor:pointer;" onclick="window._openInstrument('${item.id}')">
          <span>#${escapeHtml(item.id)} ${escapeHtml(item.name)}</span>
          <span class="badge warn">Бронирование: ${escapeHtml(item.booked_by)}</span>
        </div>`;
      });
    }
    
    if (verificationEvents.length) {
      html += `<h3>Истекает срок:</h3>`;
      verificationEvents.forEach(item => {
        html += `<div class="row panel" style="cursor:pointer;" onclick="window._openInstrument('${item.id}')">
          <span>#${escapeHtml(item.id)} ${escapeHtml(item.name)}</span>
          <span class="badge bad">Поверка</span>
        </div>`;
      });
    }
    
    html += '</div>';
    
    // Добавляем кнопку "Назад"
    html += `<div class="modal-actions"><button class="secondary" data-close>Назад</button></div>`;
    
    openModal(`События на ${dateStr}`, html);
  };

  // Функция для открытия карточки прибора из модалки
  window._openInstrument = (id) => {
    closeModal();
    // Переход на карточку прибора
    history.pushState(null, '', '?id=' + encodeURIComponent(id));
    window.dispatchEvent(new Event('popstate'));
  };

  function renderLegend() {
    return `
      <div style="margin-top:16px; padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #d9e0ea; display:flex; flex-wrap:wrap; gap:12px; align-items:center; font-size:14px;">
        <span style="font-weight:800;">Легенда:</span>
        <span><span class="day" style="display:inline-block; width:20px; height:20px; background:#dcfae6; border:1px solid #75e0a7; border-radius:4px;"></span> Срок истекает</span>
        <span><span class="day" style="display:inline-block; width:20px; height:20px; background:#fee2e2; border:1px solid #fda29b; border-radius:4px;"></span> Бронь</span>
        <span><span class="day" style="display:inline-block; width:20px; height:20px; background:#dbeafe; border:1px solid #93c5fd; border-radius:4px;"></span> Выдача</span>
        <span><span class="day" style="display:inline-block; width:20px; height:20px; background:#fef3c7; border:1px solid #fcd34d; border-radius:4px;"></span> Смешанный день</span>
        <span><span class="day" style="display:inline-block; width:20px; height:20px; background:#e9d5ff; border:1px solid #c084fc; border-radius:4px;"></span> Все события</span>
      </div>
    `;
  }

  function renderMonth(y, m) {
    const monthName = new Date(y, m).toLocaleString('ru', { month: 'long', year: 'numeric' });
    const grid = renderCalendar(y, m);
    const legend = renderLegend();
    return `
      <div class="calendar-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <button class="secondary" data-cal-prev>◀</button>
        <span style="font-weight:bold; font-size:18px;">${monthName}</span>
        <button class="secondary" data-cal-next>▶</button>
      </div>
      <div class="calendar-grid">${grid}</div>
      ${legend}
    `;
  }

  const content = renderMonth(currentYear, currentMonth);
  openModal('Календарь', content);

  const modal = document.getElementById('modal');
  const head = modal.querySelector('.modal-head');

  // Обработка закрытия модалки через кнопку "Закрыть" (крестик) - не трогаем, оставляем стандартное поведение

  function updateCalendar() {
    const body = modal.querySelector('.modal-body');
    const children = body.children;
    // Удаляем всё, кроме заголовка (head)
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i] !== head) children[i].remove();
    }
    const temp = document.createElement('div');
    temp.innerHTML = renderMonth(currentYear, currentMonth);
    while (temp.firstChild) body.appendChild(temp.firstChild);
    bindCalEvents();
  }

  function bindCalEvents() {
    const p = modal.querySelector('[data-cal-prev]');
    const n = modal.querySelector('[data-cal-next]');
    if (p) p.onclick = () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } updateCalendar(); };
    if (n) n.onclick = () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } updateCalendar(); };
  }

  bindCalEvents();
}
