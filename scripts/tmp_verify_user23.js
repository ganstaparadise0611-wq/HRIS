const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function run() {
  const p = 'C:/Users/Vince/AppData/Local/Temp/supabase_face_23.jpg';
  console.log('File exists?', fs.existsSync(p));
  const f = new FormData();
  f.append('photo', fs.createReadStream(p));
  f.append('user_id', '23');
  try {
    const res = await fetch('http://10.253.120.119:8000/verify.php', { method: 'POST', body: f, headers: f.getHeaders(), timeout: 60000 });
    console.log('STATUS', res.status);
    const text = await res.text();
    console.log(text);
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
  }
}

run();
