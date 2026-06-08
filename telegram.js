require('dotenv').config();
const { Telegraf } = require('telegraf');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const GROUP_ID = process.env.GROUP_ID;

bot.command('pair', async (ctx) => {
    const number = ctx.message.text.split(' ')[1];
    if (!number) return ctx.reply('Number dao vai. Ex: /pair +8801XXXXXXXXX');

    await ctx.reply(`Number: ${number}\nCode generate hocche... 20 sec wait koro`);

    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    sock.ev.on('creds.update', saveCreds);

    setTimeout(async () => {
        try {
            if (!sock.authState.creds.registered) {
                const code = await sock.requestPairingCode(number);
                await bot.telegram.sendMessage(GROUP_ID, `🔑 Pairing Code: ${code}\n\nWhatsApp > Linked Devices > Link a Device > Code bosao`);
                await ctx.reply(`Code group e pathay disi. 2 min er vitore bosao.`);
            }
        } catch (e) {
            ctx.reply('Code generate korte problem hoise: ' + e.message);
        } finally {
            await delay(5000);
            sock.end();
        }
    }, 20000);
});

bot.launch();
console.log('@tomxbugvip bot started on Railway...');
