export const CONFIG = {
  proxyUrl: 'https://prox-cstroy.vercel.app',
  publicKey: 'https://disk.yandex.ru/i/4YzMd8kJ_-TFTw',
  writeSecret: 'mySecretKey123'
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
