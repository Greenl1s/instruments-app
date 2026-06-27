export const CONFIG = {
  proxyUrl: 'https://autumn-queen-abbe.kirik7061.workers.dev/',
  publicKey: 'https://disk.yandex.ru/i/kAXYp4XPyNJAWg',
  writeSecret: 'mySecretKey123'
};
export const SHEETS = { instruments: 'Приборы', history: 'История', users: 'Пользователи', retired: 'Списанные' };
export const HEADERS = {
  instruments: ['id','name','serial_number','model','type','verification_date','valid_until','document_url','condition','taken_by','taken_where','taken_date'],
  history: ['instrument_id','instrument_name','user','place','issue_date','return_date','returned_by','operation_date'],
  users: ['username','password','role'],
  retired: ['id','name','serial_number','model','type','verification_date','valid_until','document_url','condition','taken_by','taken_where','taken_date','retired_date']
};
