const { Telegraf } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

function getCountry(number) {
  if (number.startsWith('+92')) return '🇵🇰 Pakistan (+92)';
  if (number.startsWith('+58')) return '🇻🇪 Venezuela (+58)';
  if (number.startsWith('+992')) return '🇹🇯 Tajikistan (+992)';
  if (number.startsWith('+91')) return '🇮🇳 India (+91)';
  if (number.startsWith('+880')) return '🇧🇩 Bangladesh (+880)';
  return '🌐 Unknown';
}

function formatNumber(num) {
  return num.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1 $2-$3$4');
}

bot.command('pair', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const userName = ctx.from.first_name;
  const replyTo = ctx.message_id;

  if (args.length < 2) {
    return ctx.replyWithHTML(
      `│ <b>${userName}</b>\n│ /Pair\n🛑 <b>Usage</b>\n\n/pair +917074420859\n/pair 917074420859\n💡 Include your country code.`,
      { reply_to_message_id: replyTo }
    );
  }

  let number = args[1].replace(/[^0-9]/g, '');
  
  const sessionId = ctx.from.id + '_' + Date.now();
  const sessionPath = path.join(__dirname, 'session', sessionId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    mobile: true, // IMPORTANT: mobile true na dile code kaj kore na
    markOnlineOnConnect: false
  });

  sock.ev.on('creds.update', saveCreds);

  let codeSent = false;
  let timeout;

  // Pairing code request
  await delay(3000);
  if (!sock.authState.creds.registered) {
    try {
      const code = await sock.requestPairingCode(number, 'XMIKU'); // 4 char device name
      codeSent = true;

      const formattedCode = code.match(/.{1,4}/g).join('-');
      const country = getCountry('+' + number);

      await ctx.replyWithHTML(
        `🔐 𝖯𝖠𝖨𝖱 𝖢𝖮𝖣𝖤 𝖱𝖤𝖠𝖣𝖸\n` +
        `📱 𝖭𝗎𝗆𝖻𝖾𝗋: ${formatNumber('+' + number)}\n` +
        `🌐 𝖢𝗈𝗎𝗇𝗍𝗋𝗒: ${country}\n\n` +
        `┌─────────────┐\n` +
        `│ 🔑 ${formattedCode}\n` +
        `└─────────────┘\n\n` +
        `📌 𝖧𝗈𝗐 𝗍𝗈 𝗅𝗂𝗇𝗄:\n` +
        `WhatsApp → Settings → Linked Devices\n` +
        `→ Link a Device → Enter code above\n` +
        `⏰ Code expires in ~60 seconds`
      );
    } catch (e) {
      await ctx.replyWithHTML(`❌ 𝖯𝖠𝖨𝖱 𝖥𝖠𝖨𝖫𝖤𝖣\n📱 𝖭𝗎𝗆𝖻𝖾𝗋: +${number}\n💬 𝖱𝖾𝖺𝗌𝗈𝗇: ${e.message}\n\n🔁 Try again with /pair +${number}`);
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      clearTimeout(timeout);
      const statusCode = (lastDisconnect.error)?.output?.statusCode;
      
      if (statusCode !== DisconnectReason.loggedOut && codeSent) {
        await ctx.replyWithHTML(
          `❌ 𝖯𝖠𝖨𝖱 𝖥𝖠𝖨𝖫𝖤𝖣\n📱 𝖭𝗎𝗆𝖻𝖾𝗋: ${formatNumber('+' + number)}\n💬 𝖱𝖾𝖺𝗌𝗈𝗇: Connection Closed\n🔁 Try again with /pair +${number}`
        );
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    }

    if (connection === 'open') {
      clearTimeout(timeout);
      const country = getCountry('+' + number);
      await ctx.replyWithHTML(
        `❤️‍🩹 𝖡𝖮𝖳 𝖢𝖮𝖭𝖤𝖢𝖳𝖤𝖣!\n\n✅ 𝖲𝗎𝖼𝖾𝗌𝖿𝗎𝗅𝗒 𝗅𝗂𝗇𝗄𝖾𝖽!\n\n📱 𝖭𝗎𝗆𝖻𝖾𝗋: ${formatNumber('+' + number)}\n${country}`
      );
      setTimeout(() => fs.rmSync(sessionPath, { recursive: true, force: true }), 5000);
    }
  });

  timeout = setTimeout(async () => {
    if (!sock.user) {
      await ctx.replyWithHTML(
        `😴 𝖯𝖠𝖨𝖱 𝖴𝖭𝖲𝖴𝖢𝖤𝖲𝖥𝖴𝖫\n⏰ 𝖳𝗂𝗆𝖾𝖽 𝗈𝗎𝗍 — 𝖼𝗈𝖽𝖾 𝗐𝖺𝗌 𝗇𝗈𝗍 𝗎𝗌𝖾𝖽.\n\n📱 𝖭𝗎𝗆𝖻𝖾𝗋: ${formatNumber('+' + number)}\n\n🔁 𝖯𝗅𝖾𝖺𝗌𝖾 𝗍𝗋𝗒 𝖺𝗀𝖺𝗂𝗇:\n/pair +${number}`
      );
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }, 60000);
});

bot.launch();
console.log('Bot started on Railway...');
