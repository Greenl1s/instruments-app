export const CONFIG = {
  proxyUrl: 'https://autumn-queen-abbe.kirik7061.workers.dev',
  publicKey: 'https://disk.yandex.ru/i/jU1KxLsivSfagA',
  writeSecret: 'mySecretKey123',
  filePath: '/Учёт.xlsx'
};

export const SHEETS = {
  instruments: 'Приборы',
  history: 'История',
  users: 'Пользователи',
  retired: 'Списанные'
};

export const HEADERS = {
  instruments: ['id','name','serial_number','model','type','verification_date','valid_until','document_url','condition','taken_by','taken_where','taken_extra','taken_date'],
  history: ['instrument_id','instrument_name','user','place','extra_data','issue_date','return_date','returned_by','operation_date'],
  users: ['username','password','role','extra'],
  retired: ['id','name','serial_number','model','type','verification_date','valid_until','document_url','condition','taken_by','taken_where','taken_extra','taken_date','retired_date']
};
