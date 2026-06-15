const { Telegraf } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const express = require('express');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const PORT = process.env.PORT || 10000;

if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN missing!');
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));

bot.start((ctx) => {
  ctx.reply('🤖 WhatsApp Pair Bot\nUsage: /pair +8801XXXXXXXXX\nExample: /pair +8801712345678');
});

bot.command('pair', async (ctx) => {
  const number = ctx.message.text.split(' ')[1]?.replace(/[^0-9+]/g, '');
  
  if (!number || !number.startsWith('+')) {
    return ctx.reply('❌ Usage: /pair +8801XXXXXXXXX');
  }

  const msg = await ctx.reply('⏳ Generating code... Wait 15 sec');
  
  try {
    const chatId = ctx.chat.id;
    const sessionId = `session_${chatId}`;
    const authDir = `./sessions/${sessionId}`;
    
    if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions');
    
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Ubuntu', 'Chrome', '20.0.04']
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    const code = await sock.requestPairingCode(number);
    const formatted = code.match(/.{1,4}/g).join('-');
    
    await ctx.telegram.editMessageText(chatId, msg.message_id, undefined,
      `🔐 PAIR CODE\n📱 Number: ${number}\n🔑 Code: ${formatted}\n\nWhatsApp → Settings → Linked Devices → Link with phone number\n⏰ Expires in 60 sec`,
      { parse_mode: 'Markdown' }
    );
    
    setTimeout(() => {
      sock.end();
      fs.rmSync(authDir, { recursive: true, force: true });
    }, 120000);
    
  } catch (e) {
    console.error(e);
    ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, '❌ Failed! Number invalid or try after 5min');
  }
});

bot.launch();
console.log('✅ Bot Started!');
