const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function run() {
  try {
    const infoRes = await fetch('http://10.253.120.119:8000/get_face_23.php');
    const infoText = await infoRes.text();
    console.log('INFO STATUS', infoRes.status);
    // Try parse JSON
    let info = null;
    try { info = JSON.parse(infoText); } catch(e) { console.error('Invalid JSON from server:', infoText.slice(0,200)); return; }
    if (!info.ok) { console.error('Server returned error:', info); return; }
    const face = info.face;
    if (!face) { console.error('No face field in response'); return; }

    // strip data url prefix
    const base = face.replace(/^data:[^;]+;base64,/, '');
    const bytes = Buffer.from(base, 'base64');
    const tmp = require('path').join(require('os').tmpdir(), 'supabase_face_23.jpg');
    fs.writeFileSync(tmp, bytes);
    console.log('Wrote temp file:', tmp, 'size', fs.statSync(tmp).size);

    const f = new FormData();
    f.append('photo', fs.createReadStream(tmp));
    f.append('user_id', '23');

    const res = await fetch('http://10.253.120.119:8000/verify.php', { method: 'POST', body: f, headers: f.getHeaders(), timeout: 60000 });
    console.log('VERIFY STATUS', res.status);
    console.log(await res.text());
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
  }
}

run();
