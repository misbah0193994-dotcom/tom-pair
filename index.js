const express = require('express');
const path = require('path');
const fs = require('fs');
const { makeWASocket, useMultiFileAuthState, requestPairingCode, Browsers, delay } = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Session ফোল্ডার ক্লিন করার ফাংশন
function clearSession(folder) {
  if(fs.existsSync(folder)) fs.rmSync(folder, {recursive: true});
}

app.post('/pair', async (req, res) => {
  let { number } = req.body;
  if(!number) return res.status(400).json({error: 'Number দাও +8801...'});
  
  number = number.replace(/[^0-9]/g, '');
  const sessionPath = `./temp_session_${Date.now()}`;
  clearSession(sessionPath);
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
      auth: state,
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // 5 সেকেন্ড পর Pair Code জেনারেট
    await delay(5000);
    const code = await requestPairingCode(sock, number);
    
    res.json({ code: code.match(/.{1,4}/g).join('-') });
    
    // কানেক্ট হলে WP তে Session ID পাঠাবে
    sock.ev.on('connection.update', async (update) => {
      const { connection } = update;
      
      if(connection === 'open') {
        await delay(3000);
        
        // Session ID বানানো
        const credsFile = path.join(sessionPath, 'creds.json');
        const sessionData = fs.readFileSync(credsFile, 'utf8');
        const sessionId = Buffer.from(sessionData).toString('base64');
        
        // নিজের WP তে মেসেজ
        await sock.sendMessage(sock.user.id + '@s.whatsapp.net', {
          text: `✅ *BOT CONNECTED SUCCESSFULLY*\n\n🔑 *SESSION ID:*\n\`\`${sessionId}\`\n\n📌 এই Session ID কপি করে Main Bot এর config এ বসাও\n\n⚠️ Session ID কাউকে দিবা না`
        });
        
        console.log('Session sent to WP:', sock.user.id);
        await delay(5000);
        sock.end();
        clearSession(sessionPath);
      }
      
      if(connection === 'close') {
        clearSession(sessionPath);
      }
    });
    
  } catch(err) {
    console.log(err);
    res.status(500).json({error: err.message});
    clearSession(sessionPath);
  }
});

app.listen(PORT, () => console.log(`Pair Site running on ${PORT}`));
