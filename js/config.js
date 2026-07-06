export const CONFIG = {
  // Основной прокси-домен (используется как fallback)
  proxyUrl: 'https://prox-cstroy.vercel.app',
  publicKey: 'https://disk.yandex.ru/i/jU1KxLsivSfagA',
  writeSecret: 'mySecretKey123'
};

// Массив всех доступных прокси-доменов (в порядке приоритета)
export const PROXY_DOMAINS = [
  'https://prox-cstroy-git-main-greenlts-projects.vercel.app',
  'https://prox-cstroy-530uik1l-greenlts-projects.vercel.app'
];

// Для удобства экспортируем publicKey отдельно (используется в proxyManager)
export const publicKey = CONFIG.publicKey;

export const SHEETS = {
  instruments: 'Приборы',
  history: 'История',
  users: 'Пользователи',
  retired: 'Списанные'
};

export const HEADERS = {
  instruments: ['id','name','serial_number','model','type','verification_date','valid_until','document_url','condition','taken_by','taken_where','taken_extra','taken_date','booked_by','booked_date','booked_extra','comment'],
  history: ['instrument_id','instrument_name','user','place','extra_data','issue_date','return_date','returned_by','operation_date'],
  users: ['username','password','role','extra'],
  retired: ['id','name','serial_number','model','type','verification_date','valid_until','document_url','condition','taken_by','taken_where','taken_extra','taken_date','retired_date']
};
