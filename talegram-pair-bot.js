const { Telegraf } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const express = require('express');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const PORT = process.env.PORT || 3000;

if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN missing in Environment Variables!');
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_TOKEN);
const app = express();
const sessions = new Map();

// Keep Render awake
app.get('/', (req, res) => {
  res.send('🤖 Telegram Pair Bot is Running! Use /start to begin.');
});
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// Start command
bot.start((ctx) => {
  ctx.reply(
    '🤖 *WhatsApp Pair Bot*\n\n' +
    '*Usage:* `/pair +8801XXXXXXXXX`\n' +
    '*Example:* `/pair +8801712345678`\n\n' +
    '⚠️ Include country code. Code expires in 60 seconds.\n' +
    '📱 After pairing, keep session folder safe.',
    { parse_mode: 'Markdown' }
  );
});

// Pair command
bot.command('pair', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const number = args[0]?.replace(/[^0-9+]/g, '');

  if (!number || !number.startsWith('+') || number.length < 10) {
    return ctx.reply(
      '❌ *Invalid number!*\n\n' +
      '*Usage:* `/pair +8801XXXXXXXXX`\n' +
      'Example: `/pair +8801712345678`',
      { parse_mode: 'Markdown' }
    );
  }

  const chatId = ctx.chat.id;
  const userName = ctx.from.first_name || 'User';

  const loadingMsg = await ctx.reply(
    `👤 ${userName}\n` +
    `/pair ${number}\n\n` +
    '⏳ Generating pair code... Please wait 15 seconds.'
  );

  try {
    const sessionId = `session_${chatId}_${Date.now()}`;
    const authDir = path.join('./sessions', sessionId);

    if (!fs.existsSync('./sessions')) {
      fs.mkdirSync('./sessions', { recursive: true });
    }
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Render', 'Chrome', '20.0.04']
    });

    sock.ev.on('creds.update', saveCreds);

    // Request pairing code
    const code = await sock.requestPairingCode(number);
    const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

    await ctx.telegram.editMessageText(
      chatId,
      loadingMsg.message_id,
      undefined,
      `🔐 *PAIR CODE READY*\n\n` +
      `📱 Number: \`${number}\`\n` +
      `🌍 Country: ${getCountryFlag(number)}\n\n` +
      `🔑 *Code:* \`${formattedCode}\`\n\n` +
      `📌 *How to link:*\n` +
      `1. WhatsApp → Settings → Linked Devices\n` +
      `2. Tap "Link a Device"\n` +
      `3. Tap "Link with phone number"\n` +
      `4. Enter code above\n` +
      `⏰ Code expires in ~60 seconds\n` +
      `⚠️ Session: \`${sessionId}\``,
      { parse_mode: 'Markdown' }
    );

    sessions.set(chatId, { sock, authDir });

    // Auto cleanup after 2 minutes
    setTimeout(async () => {
      try {
        await sock.end();
        fs.rmSync(authDir, { recursive: true, force: true });
        sessions.delete(chatId);
        console.log(`🗑️ Session ${sessionId} cleaned`);
      } catch (e) {}
    }, 120000);

  } catch (err) {
    console.error('Pair error:', err);
    await ctx.telegram.editMessageText(
      chatId,
      loadingMsg.message_id,
      undefined,
      '❌ Failed to generate code!\n\n' +
      'Possible reasons:\n' +
      '• Invalid number or not on WhatsApp\n' +
      '• Too many requests. Try again after 5 min\n' +
      '• Network error'
    );
  }
});

function getCountryFlag(number) {
  if (number.startsWith('+880')) return '🇧🇩 Bangladesh (+880)';
  if (number.startsWith('+91')) return '🇮🇳 India (+91)';
  if (number.startsWith('+1')) return '🇺🇸 USA/Canada (+1)';
  if (number.startsWith('+44')) return '🇬🇧 UK (+44)';
  return `🌍 ${number.substring(0, 4)}`;
}

bot.launch().then(() => {
  console.log('✅ Telegram Pair Bot Started Successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
