const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const config = require("./config");
const TelegramBot = require("node-telegram-bot-api");
const database = require("./lib/database");
const ngrokManager  = require("./lib/ngrokManager");
const geminiAgent   = require("./lib/geminiAgent");
const learningDB    = require("./lib/learningDB");
const fileServer    = require("./lib/fileServer");
const os            = require("os");
const fsExtra       = require("fs-extra");

const BOT_INDEX = parseInt(process.env.BOT_INDEX || process.argv[2] || "1");
const PORT = parseInt(process.env.PORT || (2999 + BOT_INDEX));
const SESSION_DIR = path.join(__dirname, `session${BOT_INDEX}`);
const TG_TOKEN_KEY = BOT_INDEX === 1 ? "telegramBotToken" : `telegramBotToken${BOT_INDEX}`;
const TG_TOKEN = config[TG_TOKEN_KEY];

if (!TG_TOKEN) {
    console.error(`❌ No Telegram token found for Bot ${BOT_INDEX} (config.${TG_TOKEN_KEY}). Add it to config.js.`);
    process.exit(1);
}

let store;
try {
    const { makeInMemoryStore } = require("@whiskeysockets/baileys");
    if (typeof makeInMemoryStore === "function") {
        store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });
    } else throw new Error("not a function");
} catch (e) {
    console.log(`⚠️ [Bot ${BOT_INDEX}] makeInMemoryStore not available. Using fallback.`);
    store = {
        messages: {}, contacts: {},
        bind: (ev) => {
            ev.on("messages.upsert", ({ messages }) => {
                for (const msg of messages) {
                    const jid = msg.key.remoteJid;
                    if (!store.messages[jid]) store.messages[jid] = {};
                    store.messages[jid][msg.key.id] = msg;
                }
            });
        },
        loadMessage: async (jid, id) => store.messages[jid]?.[id] || null,
        toJSON: () => ({}), fromJSON: () => {}
    };
}

let sock = null;

async function requestPairing(chatId, phoneNumber, source = "telegram") {
    let waited = 0;
    while (!sock && waited < 15000) {
        await new Promise(r => setTimeout(r, 500));
        waited += 500;
    }

    if (!sock) {
        const msg = `┌ ❏ ◆ ⌜⏳ 𝗪𝗔𝗜𝗧𝗜𝗡𝗚⌟ ◆\n│\n├◆ ʙᴏᴛ ɪs sᴛᴀʀᴛɪɴɢ ᴜᴘ...\n├◆ ᴘʟᴇᴀsᴇ ᴛʀʏ /pair ᴀɢᴀɪɴ ɪɴ 5s\n│\n└ ❏`;
        if (source === "telegram" && chatId) tgBot.sendMessage(chatId, msg);
        return { success: false, error: "Socket not ready" };
    }

    if (sock.authState?.creds?.registered) {
        const msg = `┌ ❏ ◆ ⌜✅ 𝗔𝗟𝗥𝗘𝗔𝗗𝗬 𝗣𝗔𝗜𝗥𝗘𝗗⌟ ◆\n│\n├◆ ʙᴏᴛ ɪs ᴀʟʀᴇᴀᴅʏ ᴄᴏɴɴᴇᴄᴛᴇᴅ!\n├◆ ᴜsᴇ /unpair ᴛᴏ ᴅɪsᴄᴏɴɴᴇᴄᴛ\n│\n└ ❏`;
        if (source === "telegram") tgBot.sendMessage(chatId, msg);
        return { success: false, error: "Already paired" };
    }

    try {
        const phone = phoneNumber.replace(/[^0-9]/g, "");
        console.log(`[Bot ${BOT_INDEX}] Requesting pairing code for ${phone}...`);
        const code = await sock.requestPairingCode(phone);
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
        database.addSession(`${source}_${chatId || phone}_bot${BOT_INDEX}`, phone);

        if (source === "telegram") {
            tgBot.sendMessage(chatId,
                `┌ ❏ ◆ ⌜𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗖𝗢𝗗𝗘⌟ ◆\n│\n` +
                `├◆ 🔑 ʏᴏᴜʀ ᴄᴏᴅᴇ: *${formattedCode}*\n│\n` +
                `├◆ 📱 sᴛᴇᴘs:\n` +
                `├◆ 1. ᴏᴘᴇɴ ᴡʜᴀᴛsᴀᴘᴘ\n` +
                `├◆ 2. ʟɪɴᴋᴇᴅ ᴅᴇᴠɪᴄᴇs\n` +
                `├◆ 3. ʟɪɴᴋ ᴀ ᴅᴇᴠɪᴄᴇ\n` +
                `├◆ 4. ʟɪɴᴋ ᴡɪᴛʜ ᴘʜᴏɴᴇ ɴᴜᴍʙᴇʀ\n` +
                `├◆ 5. ᴇɴᴛᴇʀ ᴛʜᴇ ᴄᴏᴅᴇ ᴀʙᴏᴠᴇ\n│\n└ ❏\n` +
                `├◆ ⚠️ ᴄᴏᴅᴇ ᴇxᴘɪʀᴇs ɪɴ 60s\n└ ❏`,
                { parse_mode: "Markdown" }
            );
        }
        return { success: true, code: formattedCode };
    } catch (e) {
        console.error(`[Bot ${BOT_INDEX}] Pairing error:`, e.message);
        const errMsg = `┌ ❏ ◆ ⌜❌ 𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗙𝗔𝗜𝗟𝗘𝗗⌟ ◆\n│\n├◆ ${e.message}\n├◆ ᴛʀʏ /pair ᴀɢᴀɪɴ\n│\n└ ❏`;
        if (source === "telegram") tgBot.sendMessage(chatId, errMsg);
        return { success: false, error: e.message };
    }
}

const MAX_SESSIONS = 100;
const tgBot = new TelegramBot(TG_TOKEN, { polling: true });
let tgPairingUsers = new Map();

const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "☀️ ɢᴏᴏᴅ ᴍᴏʀɴɪɴɢ" : h < 17 ? "☀️ ɢᴏᴏᴅ ᴀғᴛᴇʀɴᴏᴏɴ" : "🌙 ɢᴏᴏᴅ ᴇᴠᴇɴɪɴɢ";
};
const fmtUptime = () => {
    const u = process.uptime();
    return `${Math.floor(u / 3600)}ʜ ${Math.floor((u % 3600) / 60)}ᴍ ${Math.floor(u % 60)}s`;
};
const isOwner = (chatId) => chatId.toString() === config.telegramOwnerId?.toString();
const isTgAdmin = (chatId) => isOwner(chatId) || database.isAdmin(chatId);

console.log(`📱 [Bot ${BOT_INDEX}] Telegram Bot started.`);

tgBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || "User";
    database.trackUser(`tg_${chatId}`, name);
    const activeSessions = database.getActiveSessions();
    tgBot.sendMessage(chatId,
        `┌ ❏ ◆ ⌜𝗠𝗔𝗜𝗡 𝗠𝗘𝗡𝗨⌟ ◆\n│\n` +
        `├◆ ${getGreeting()}, ${name}\n` +
        `├◆ ʙᴏᴛ ɪɴsᴛᴀɴᴄᴇ: #${BOT_INDEX}\n` +
        `├◆ ᴜᴘᴛɪᴍᴇ: ${fmtUptime()}\n` +
        `├◆ sᴇssɪᴏɴs: ${activeSessions.length}/${MAX_SESSIONS}\n│\n└ ❏\n` +
        `┌ ❏ ◆ ⌜𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦⌟ ◆\n│\n` +
        `├◆ /pair    - ᴘᴀɪʀ ᴡʜᴀᴛsᴀᴘᴘ\n` +
        `├◆ /unpair  - ʀᴇᴍᴏᴠᴇ sᴇssɪᴏɴ\n` +
        `├◆ /id      - ɢᴇᴛ ʏᴏᴜʀ ᴛᴇʟᴇɢʀᴀᴍ ɪᴅ\n` +
        `├◆ /ping    - ʟᴀᴛᴇɴᴄʏ ᴄʜᴇᴄᴋ\n` +
        `├◆ /runtime - sʏsᴛᴇᴍ ᴜᴘᴛɪᴍᴇ\n` +
        `├◆ /stats   - ʙᴏᴛ sᴛᴀᴛɪsᴛɪᴄs\n` +
        `├◆ /report  - ᴄᴏɴᴛᴀᴄᴛ sᴜᴘᴘᴏʀᴛ\n` +
        `├◆ /help    - ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ\n│\n└ ❏\n` +
        `┌ ❏ ◆ ⌜𝗔𝗗𝗠𝗜𝗡⌟ ◆\n│\n` +
        `├◆ /users /listpair /broadcast\n` +
        `├◆ /ban /unban /checkuser\n` +
        `├◆ /allowuser /removeuser /listusers\n` +
        `├◆ /addadmin /removeadmin\n` +
        `├◆ /maintenance /logs /restart\n│\n└ ❏`,
        { parse_mode: "Markdown" }
    );
});

tgBot.onText(/\/id/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : "ɴᴏ ᴜsᴇʀɴᴀᴍᴇ";
    tgBot.sendMessage(chatId,
        `┌ ❏ ◆ ⌜𝗬𝗢𝗨𝗥 𝗜𝗗⌟ ◆\n│\n` +
        `├◆ 🆔 ɪᴅ: \`${msg.from.id}\`\n` +
        `├◆ 👤 ɴᴀᴍᴇ: ${msg.from.first_name || "Unknown"}\n` +
        `├◆ 🔖 ᴜsᴇʀɴᴀᴍᴇ: ${username}\n│\n└ ❏`,
        { parse_mode: "Markdown" }
    );
});

tgBot.onText(/\/pair/, (msg) => {
    const chatId = msg.chat.id;
    const name   = msg.from.first_name || 'User';

    const allowed = config.openPairing || isTgAdmin(chatId) || database.isTgUserAllowed(chatId);
    if (!allowed) {
        return tgBot.sendMessage(chatId,
            `┌ ❏ ◆ ⌜❌ 𝗔𝗖𝗖𝗘𝗦𝗦 𝗗𝗘𝗡𝗜𝗘𝗗⌟ ◆\n│\n` +
            `├◆ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴀᴜᴛʜᴏʀɪᴢᴇᴅ\n` +
            `├◆ ᴄᴏɴᴛᴀᴄᴛ ᴀɴ ᴀᴅᴍɪɴ\n│\n└ ❏`
        );
    }
    if (database.isUserBanned(`tg_${chatId}`)) {
        return tgBot.sendMessage(chatId, `┌ ❏ ◆ ⌜🚫 𝗕𝗔𝗡𝗡𝗘𝗗⌟ ◆\n│\n├◆ ʏᴏᴜ ᴀʀᴇ ʀᴇsᴛʀɪᴄᴛᴇᴅ\n│\n└ ❏`);
    }
    if (database.db.maintenance && !isTgAdmin(chatId)) {
        return tgBot.sendMessage(chatId, `┌ ❏ ◆ ⌜🔧 𝗠𝗔𝗜𝗡𝗧𝗘𝗡𝗔𝗡𝗖𝗘⌟ ◆\n│\n├◆ ʙᴏᴛ ᴜɴᴅᴇʀ ᴍᴀɪɴᴛᴇɴᴀɴᴄᴇ\n│\n└ ❏`);
    }

    const activeSessions = database.getActiveSessions();
    if (activeSessions.length >= MAX_SESSIONS) {
        return tgBot.sendMessage(chatId,
            `┌ ❏ ◆ ⌜⚠️ 𝗖𝗔𝗣𝗔𝗖𝗜𝗧𝗬 𝗙𝗨𝗟𝗟⌟ ◆\n│\n` +
            `├◆ ᴍᴀx sᴇssɪᴏɴs ʀᴇᴀᴄʜᴇᴅ ()\n` +
            `├◆ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ\n│\n└ ❏`
        );
    }

    const existingSession = database.db.sessions[`tg_${chatId}_bot${BOT_INDEX}`];
    if (existingSession && existingSession.active) {
        return tgBot.sendMessage(chatId,
            `┌ ❏ ◆ ⌜✅ 𝗔𝗟𝗥𝗘𝗔𝗗𝗬 𝗣𝗔𝗜𝗥𝗘𝗗⌟ ◆\n│\n` +
            `├◆ 📱 ɴᴜᴍʙᴇʀ: ${existingSession.phone}\n` +
            `├◆ ✅ ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ ɪs ᴄᴏɴɴᴇᴄᴛᴇᴅ\n│\n` +
            `├◆ ᴜsᴇ /myunpair ᴛᴏ ᴅɪsᴄᴏɴɴᴇᴄᴛ\n└ ❏`
        );
    }

    tgPairingUsers.set(chatId, { state: 'awaiting_number' });
    tgBot.sendMessage(chatId,
        `┌ ❏ ◆ ⌜📱 𝗣𝗔𝗜𝗥 𝗬𝗢𝗨𝗥 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣⌟ ◆\n│\n` +
        `├◆ 👋 ʜɪ ${name}!\n│\n` +
        `├◆ 📲 sᴇɴᴅ ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ\n` +
        `├◆ ғᴏʀᴍᴀᴛ: ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ + ɴᴜᴍʙᴇʀ\n` +
        `├◆ ᴇxᴀᴍᴘʟᴇ: 2347012345678\n│\n` +
        `├◆ ⚠️ ɴᴏ + ᴏʀ sᴘᴀᴄᴇs\n└ ❏`
    );
});

tgBot.onText(/\/mystatus/, (msg) => {
    const chatId = msg.chat.id;
    const session = database.db.sessions[`tg_${chatId}_bot${BOT_INDEX}`];
    if (session && session.active) {
        tgBot.sendMessage(chatId,
            `┌ ❏ ◆ ⌜✅ 𝗣𝗔𝗜𝗥𝗘𝗗⌟ ◆\n│\n` +
            `├◆ 📱 ɴᴜᴍʙᴇʀ: ${session.phone}\n` +
            `├◆ 📅 sɪɴᴄᴇ: ${new Date(session.pairedAt).toLocaleDateString()}\n│\n` +
            `├◆ ᴜsᴇ /myunpair ᴛᴏ ᴅɪsᴄᴏɴɴᴇᴄᴛ\n└ ❏`
        );
    } else {
        tgBot.sendMessage(chatId,
            `┌ ❏ ◆ ⌜❌ ɴᴏᴛ 𝗣𝗔𝗜𝗥𝗘𝗗⌟ ◆\n│\n` +
            `├◆ ᴜsᴇ /pair ᴛᴏ ᴄᴏɴɴᴇᴄᴛ ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ\n└ ❏`
        );
    }
});

tgBot.onText(/\/myunpair/, (msg) => {
    const chatId = msg.chat.id;
    const sessionKey = `tg_${chatId}_bot${BOT_INDEX}`;
    const session = database.db.sessions[sessionKey];
    if (session && session.active) {
        database.removeSession(sessionKey);
        tgBot.sendMessage(chatId,
            `┌ ❏ ◆ ⌜🔌 𝗨𝗡𝗣𝗔𝗜𝗥𝗘𝗗⌟ ◆\n│\n` +
            `├◆ ✅ ʏᴏᴜʀ sᴇssɪᴏɴ ᴡᴀs ʀᴇᴍᴏᴠᴇᴅ\n` +
            `├◆ ᴜsᴇ /pair ᴛᴏ ʀᴇᴄᴏɴɴᴇᴄᴛ\n│\n└ ❏`
        );
    } else {
        tgBot.sendMessage(chatId, `❌ No active session to remove.`);
    }
});


tgBot.onText(/\/unpair/, (msg) => {
    const chatId = msg.chat.id;
    if (fs.existsSync(SESSION_DIR)) {
        try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            database.removeSession(`tg_${chatId}`);
            tgBot.sendMessage(chatId,
                `┌ ❏ ◆ ⌜𝗨𝗡𝗣𝗔𝗜𝗥𝗘𝗗⌟ ◆\n│\n` +
                `├◆ ✅ sᴇssɪᴏɴ ʀᴇᴍᴏᴠᴇᴅ\n` +
                `├◆ ᴜsᴇ /pair ᴛᴏ ʀᴇᴄᴏɴɴᴇᴄᴛ\n│\n└ ❏`
            );
        } catch (e) {
            tgBot.sendMessage(chatId, "❌ Failed: " + e.message);
        }
    } else {
        tgBot.sendMessage(chatId, `┌ ❏ ◆ ⌜𝗨𝗡𝗣𝗔𝗜𝗥⌟ ◆\n│\n├◆ ɴᴏ ᴀᴄᴛɪᴠᴇ sᴇssɪᴏɴ\n│\n└ ❏`);
    }
});

tgBot.onText(/\/ping/, (msg) => {
    const start = Date.now();
    tgBot.sendMessage(msg.chat.id, "🏓 Pinging...").then(() => {
        tgBot.sendMessage(msg.chat.id,
            `┌ ❏ ◆ ⌜𝗣𝗜𝗡𝗚⌟ ◆\n│\n` +
            `├◆ 🏓 ᴘᴏɴɢ!\n` +
            `├◆ ʟᴀᴛᴇɴᴄʏ: ${Date.now() - start}ᴍs\n` +
            `├◆ ʙᴏᴛ #${BOT_INDEX}: 🟢 ᴏɴʟɪɴᴇ\n│\n└ ❏`
        );
    });
});

tgBot.onText(/\/runtime/, (msg) => {
    tgBot.sendMessage(msg.chat.id,
        `┌ ❏ ◆ ⌜𝗥𝗨𝗡𝗧𝗜𝗠𝗘⌟ ◆\n│\n` +
        `├◆ ⏱️ ᴜᴘᴛɪᴍᴇ: ${fmtUptime()}\n` +
        `├◆ ʙᴏᴛ ɪɴsᴛᴀɴᴄᴇ: #${BOT_INDEX}\n│\n└ ❏`
    );
});

tgBot.onText(/\/stats/, (msg) => {
    const s = database.db.stats;
    const activeSessions = database.getActiveSessions();
    tgBot.sendMessage(msg.chat.id,
        `┌ ❏ ◆ ⌜𝗦𝗧𝗔𝗧𝗜𝗦𝗧𝗜𝗖𝗦⌟ ◆\n│\n` +
        `├◆ 👥 ᴜsᴇʀs: ${s.totalUsers}\n` +
        `├◆ 💬 ᴍᴇssᴀɢᴇs: ${s.totalMessages}\n` +
        `├◆ ⚡ ᴄᴏᴍᴍᴀɴᴅs: ${s.totalCommands}\n` +
        `├◆ 📊 ᴛᴏᴅᴀʏ: ${s.todayCommands}\n` +
        `├◆ 🔗 sᴇssɪᴏɴs: ${activeSessions.length}/${MAX_SESSIONS}\n` +
        `├◆ ⏱️ ᴜᴘᴛɪᴍᴇ: ${fmtUptime()}\n│\n└ ❏`
    );
});

tgBot.onText(/\/report (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const report = match[1];
    const reportId = `${chatId}_${Date.now()}`;
    database.addLog("USER_REPORT", { from: chatId, name: msg.from.first_name, report });
    database.storePendingReport(reportId, chatId, msg.from.first_name || "User", report);

    const adminTargets = [config.telegramOwnerId, ...database.db.admins].filter(Boolean);
    adminTargets.forEach(adminId => {
        try {
            tgBot.sendMessage(adminId,
                `┌ ❏ ◆ ⌜📩 𝗡𝗘𝗪 𝗥𝗘𝗣𝗢𝗥𝗧⌟ ◆\n│\n` +
                `├◆ ғʀᴏᴍ: ${msg.from.first_name || "User"} (${chatId})\n` +
                `├◆ ᴍᴇssᴀɢᴇ: ${report}\n│\n` +
                `├◆ ʀᴇᴘʟʏ ᴡɪᴛʜ:\n` +
                `├◆ /reply ${reportId} [ʏᴏᴜʀ ʀᴇsᴘᴏɴsᴇ]\n│\n└ ❏`
            );
        } catch (_) {}
    });
    tgBot.sendMessage(chatId, `┌ ❏ ◆ ⌜𝗥𝗘𝗣𝗢𝗥𝗧⌟ ◆\n│\n├◆ ✅ ʀᴇᴘᴏʀᴛ sᴇɴᴛ ᴛᴏ ᴀᴅᴍɪɴ\n│\n└ ❏`);
});

tgBot.onText(/^\/report$/, (msg) => {
    tgBot.sendMessage(msg.chat.id, `┌ ❏ ◆ ⌜𝗥𝗘𝗣𝗢𝗥𝗧⌟ ◆\n│\n├◆ ᴜsᴀɢᴇ: /report [message]\n│\n└ ❏`);
});

tgBot.onText(/\/reply (\S+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const report = database.getPendingReport(match[1]);
    if (!report) return tgBot.sendMessage(chatId, `❌ Report not found or already resolved.`);
    try {
        tgBot.sendMessage(report.fromChatId,
            `┌ ❏ ◆ ⌜📨 𝗔𝗗𝗠𝗜𝗡 𝗥𝗘𝗣𝗟𝗬⌟ ◆\n│\n` +
            `├◆ ʀᴇ: ʏᴏᴜʀ ʀᴇᴘᴏʀᴛ\n` +
            `├◆ "${match[2]}"\n│\n└ ❏`
        );
    } catch (_) {}
    database.deletePendingReport(match[1]);
    tgBot.sendMessage(chatId, `✅ Reply sent to ${report.fromName}`);
});

tgBot.onText(/\/help/, (msg) => {
    tgBot.sendMessage(msg.chat.id,
        `┌ ❏ ◆ ⌜𝗛𝗘𝗟𝗣⌟ ◆\n│\n` +
        `├◆ /pair     - ᴘᴀɪʀ ᴡʜᴀᴛsᴀᴘᴘ\n` +
        `├◆ /unpair   - ʀᴇᴍᴏᴠᴇ sᴇssɪᴏɴ\n` +
        `├◆ /id       - ɢᴇᴛ ʏᴏᴜʀ ɪᴅ\n` +
        `├◆ /ping     - ʟᴀᴛᴇɴᴄʏ\n` +
        `├◆ /runtime  - ᴜᴘᴛɪᴍᴇ\n` +
        `├◆ /stats    - sᴛᴀᴛɪsᴛɪᴄs\n` +
        `├◆ /report   - ᴄᴏɴᴛᴀᴄᴛ sᴜᴘᴘᴏʀᴛ\n│\n└ ❏`
    );
});

tgBot.onText(/\/tutorial/, (msg) => {
    tgBot.sendMessage(msg.chat.id,
        `┌ ❏ ◆ ⌜𝗧𝗨𝗧𝗢𝗥𝗜𝗔𝗟⌟ ◆\n│\n` +
        `├◆ 1. sᴇɴᴅ /pair\n` +
        `├◆ 2. ᴇɴᴛᴇʀ ʏᴏᴜʀ ɴᴜᴍʙᴇʀ\n` +
        `├◆ 3. ɢᴇᴛ ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ\n` +
        `├◆ 4. ᴏᴘᴇɴ ᴡʜᴀᴛsᴀᴘᴘ\n` +
        `├◆ 5. ʟɪɴᴋᴇᴅ ᴅᴇᴠɪᴄᴇs > ʟɪɴᴋ\n` +
        `├◆ 6. ᴇɴᴛᴇʀ ᴛʜᴇ ᴄᴏᴅᴇ\n│\n└ ❏`
    );
});

tgBot.onText(/\/users/, (msg) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const users = Object.entries(database.db.users);
    const recent = users.sort((a, b) => b[1].lastSeen - a[1].lastSeen).slice(0, 20);
    let list = `┌ ❏ ◆ ⌜𝗨𝗦𝗘𝗥𝗦⌟ ◆\n│\n├◆ ᴛᴏᴛᴀʟ: ${users.length}\n│\n`;
    recent.forEach(([, u]) => { list += `├◆ ${u.name} | ᴄᴍᴅs: ${u.commandCount}\n`; });
    list += `│\n└ ❏`;
    tgBot.sendMessage(chatId, list);
});

tgBot.onText(/\/listpair/, (msg) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const sessions = database.getActiveSessions();
    let list = `┌ ❏ ◆ ⌜𝗦𝗘𝗦𝗦𝗜𝗢𝗡𝗦⌟ ◆\n│\n├◆ ᴛᴏᴛᴀʟ: ${sessions.length}\n│\n`;
    sessions.forEach(([, s]) => { list += `├◆ ${s.phone} | ${new Date(s.pairedAt).toLocaleDateString()}\n`; });
    list += `│\n└ ❏`;
    tgBot.sendMessage(chatId, list);
});

tgBot.onText(/\/broadcast (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const message = match[1];
    const users = Object.keys(database.db.users).filter(id => id.startsWith("tg_"));
    let sent = 0;
    users.forEach(uid => {
        try { tgBot.sendMessage(uid.replace("tg_", ""), `📢 ${message}`); sent++; } catch (_) {}
    });
    tgBot.sendMessage(chatId, `✅ Sent to ${sent} users.`);
});

tgBot.onText(/\/ban (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    database.banUser(match[1].trim());
    tgBot.sendMessage(chatId, `✅ Banned: ${match[1].trim()}`);
});

tgBot.onText(/\/unban (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    database.unbanUser(match[1].trim());
    tgBot.sendMessage(chatId, `✅ Unbanned: ${match[1].trim()}`);
});

tgBot.onText(/\/checkuser (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const uid = match[1].trim();
    const user = database.db.users[uid] || database.db.users[`tg_${uid}`];
    if (!user) return tgBot.sendMessage(chatId, "❌ User not found");
    tgBot.sendMessage(chatId,
        `┌ ❏ ◆ ⌜𝗨𝗦𝗘𝗥⌟ ◆\n│\n` +
        `├◆ ɴᴀᴍᴇ: ${user.name}\n` +
        `├◆ ᴍsɢs: ${user.messageCount}\n` +
        `├◆ ᴄᴍᴅs: ${user.commandCount}\n` +
        `├◆ ʙᴀɴɴᴇᴅ: ${database.isUserBanned(uid) ? "Yes" : "No"}\n│\n└ ❏`
    );
});

tgBot.onText(/\/maintenance/, (msg) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const newState = !database.db.maintenance;
    database.setMaintenance(newState);
    tgBot.sendMessage(chatId, `🔧 Maintenance: ${newState ? "🔴 ON" : "🟢 OFF"}`);
});

tgBot.onText(/\/logs/, (msg) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const logs = database.db.logs.slice(-15);
    let list = `┌ ❏ ◆ ⌜𝗟𝗢𝗚𝗦⌟ ◆\n│\n`;
    logs.forEach(l => { list += `├◆ [${new Date(l.timestamp).toLocaleString()}] ${l.action}\n`; });
    list += `│\n└ ❏`;
    tgBot.sendMessage(chatId, list);
});

tgBot.onText(/\/clean/, (msg) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const before = database.getActiveSessions().length;
    Object.entries(database.db.sessions).forEach(([id, s]) => {
        if (s.active && Date.now() - s.pairedAt > 30 * 24 * 60 * 60 * 1000) database.removeSession(id);
    });
    const after = database.getActiveSessions().length;
    tgBot.sendMessage(chatId, `✅ Removed ${before - after} old sessions. Active: ${after}`);
});

tgBot.onText(/\/addadmin (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return tgBot.sendMessage(chatId, "❌ ᴏᴡɴᴇʀ ᴏɴʟʏ");
    const adminId = parseInt(match[1].trim());
    if (isNaN(adminId)) return tgBot.sendMessage(chatId, "❌ Invalid ID");
    database.addAdmin(adminId);
    tgBot.sendMessage(chatId, `✅ Admin added: ${adminId}`);
});

tgBot.onText(/\/removeadmin (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return tgBot.sendMessage(chatId, "❌ ᴏᴡɴᴇʀ ᴏɴʟʏ");
    database.removeAdmin(parseInt(match[1].trim()));
    tgBot.sendMessage(chatId, `✅ Admin removed.`);
});

tgBot.onText(/\/allowuser (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    database.addAllowedTgUser(match[1].trim());
    tgBot.sendMessage(chatId, `✅ User allowed: ${match[1].trim()}`);
});

tgBot.onText(/\/removeuser (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    database.removeAllowedTgUser(match[1].trim());
    tgBot.sendMessage(chatId, `✅ User access removed.`);
});

tgBot.onText(/\/listusers/, (msg) => {
    const chatId = msg.chat.id;
    if (!isTgAdmin(chatId)) return tgBot.sendMessage(chatId, "❌ ᴀᴅᴍɪɴ ᴏɴʟʏ");
    const users = database.getAllowedTgUsers();
    if (users.length === 0) return tgBot.sendMessage(chatId, `👥 Open access (all users allowed)`);
    let list = `┌ ❏ ◆ ⌜𝗔𝗟𝗟𝗢𝗪𝗘𝗗 𝗨𝗦𝗘𝗥𝗦⌟ ◆\n│\n`;
    users.forEach((uid, i) => { list += `├◆ ${i + 1}. ${uid}\n`; });
    list += `│\n└ ❏`;
    tgBot.sendMessage(chatId, list);
});

tgBot.onText(/\/restart/, (msg) => {
    const chatId = msg.chat.id;
    if (!isOwner(chatId)) return tgBot.sendMessage(chatId, "❌ ᴏᴡɴᴇʀ ᴏɴʟʏ");
    tgBot.sendMessage(chatId, `🔄 Restarting Bot #${BOT_INDEX}...`).then(() => process.exit(0));
});

tgBot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith("/")) return;
    const userData = tgPairingUsers.get(chatId);
    if (!userData || userData.state !== "awaiting_number") return;
    const phoneNumber = text.replace(/[^0-9]/g, "");
    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
        return tgBot.sendMessage(chatId, "❌ Invalid number. Example: 2347012345678");
    }
    tgPairingUsers.delete(chatId);
    tgBot.sendMessage(chatId, `⏳ Generating pairing code for ${phoneNumber}...`);
    await requestPairing(chatId, phoneNumber, "telegram");
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));
app.use(express.json());

app.post("/api/pair", async (req, res) => {
    const apiKey = req.headers["x-api-key"] || req.body.apiKey;
    if (!apiKey || apiKey !== config.apiSecretKey) {
        return res.status(401).json({ success: false, error: "Invalid API key" });
    }
    const phone = (req.body.phone || "").replace(/[^0-9]/g, "");
    if (!phone || phone.length < 10) {
        return res.status(400).json({ success: false, error: "Invalid phone number" });
    }
    const result = await requestPairing(null, phone, "api");
    res.json(result);
});

app.get("/api/status", (req, res) => {
    const apiKey = req.headers["x-api-key"] || req.query.apiKey;
    if (!apiKey || apiKey !== config.apiSecretKey) {
        return res.status(401).json({ success: false, error: "Invalid API key" });
    }
    res.json({
        success: true,
        botIndex: BOT_INDEX,
        connected: !!(sock?.authState?.creds?.registered),
        uptime: process.uptime(),
        sessions: database.getActiveSessions().length
    });
});

app.use("/generated", (req, res, next) => {
    const filename = path.basename(req.path);
    const filePath = path.join(__dirname, "public/generated", filename);
    if (!fs.existsSync(filePath)) return res.status(404).send("File not found or expired.");
    if (req.query.download === "1") {
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }
    res.sendFile(filePath);
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/dashboard.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public/admin.html")));
app.get("/pair", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));

const ADMIN_SESSIONS = new Map();
function genToken() { return require("crypto").randomBytes(20).toString("hex"); }
function verifyAdmin(token) { const s = ADMIN_SESSIONS.get(token); return s && (Date.now() - s.createdAt < 4 * 3600000); }

global.messageCount = global.messageCount || 0;
const recentLogs = [];
function pushLog(line) {
    recentLogs.push({ text: line, ts: Date.now() });
    if (recentLogs.length > 200) recentLogs.shift();
    io.emit("adminLog", line);
}
const _origLog = console.log.bind(console);
console.log = (...args) => { const line = args.map(String).join(" "); _origLog(line); pushLog(line); };
const _origWarn = console.warn.bind(console);
console.warn = (...args) => { const line = "WARN: "+args.map(String).join(" "); _origWarn(line); pushLog(line); };
const _origErr = console.error.bind(console);
console.error = (...args) => { const line = "ERROR: "+args.map(String).join(" "); _origErr(line); pushLog(line); };

io.on("connection", (socket) => {
    socket.on("pair", async (phone) => {
        if (!phone) return socket.emit("log", "Please enter a phone number");
        const result = await requestPairing(null, phone.replace(/[^0-9]/g, ""), "web");
        if (result.success) {
            socket.emit("pairingCode", result.code);
            socket.emit("log", `✅ Pairing Code: ${result.code}`);
        } else {
            socket.emit("log", `❌ ${result.error}`);
        }
    });

    socket.on("getDashboard", async () => {
        const ngUrl = ngrokManager.getUrl();
        const sessions = database.getActiveSessions ? database.getActiveSessions() : [];
        let cmdCount = 0;
        try { const cmdDir = path.join(__dirname,"commands"); const scan = d => { fs.readdirSync(d).forEach(f => { const fp=path.join(d,f); if(fs.statSync(fp).isDirectory()) scan(fp); else if(f.endsWith(".js")) cmdCount++; }); }; scan(cmdDir); } catch(e) {}
        const lgAll = learningDB.getAllGroups ? learningDB.getAllGroups() : [];
        const lbData = await getLeaderboardData();
        socket.emit("stats", { sessions: sessions.length, commands: cmdCount, messages: global.messageCount||0, groups: lgAll.length, uptime: process.uptime(), ngrokUrl: ngUrl });
        socket.emit("commands", getCommandList());
        socket.emit("leaderboard", lbData);
        socket.emit("learningGroups", lgAll.map(g => ({ name: g.id.split("@")[0], topic: g.topic, language: g.language, students: g.students ? Object.keys(g.students).length : 0, aiMode: g.aiMode||"off" })));
        socket.emit("activity", getRecentActivity());
    });
    socket.on("getSessions", () => {
        const sessions = database.getActiveSessions ? database.getActiveSessions() : [];
        socket.emit("sessions", sessions);
    });
    socket.on("getLeaderboard", async () => socket.emit("leaderboard", await getLeaderboardData()));

    socket.on("adminLogin", ({ user, pass }) => {
        const validUser = user === (config.adminUser || "admin");
        const validPass = pass === (config.adminPassword || "giftaxis123");
        if (!validUser || !validPass) return socket.emit("adminLoginResult", { success: false, error: "Invalid credentials" });
        const token = genToken();
        ADMIN_SESSIONS.set(token, { user, createdAt: Date.now() });
        socket.emit("adminLoginResult", { success: true, token, user });
    });

    socket.on("getAdminDashboard", ({ token }) => {
        if (!verifyAdmin(token)) return socket.emit("adminLoginResult", { success: false, error: "Session expired" });
        const ngUrl = ngrokManager.getUrl();
        const sessions = database.getActiveSessions ? database.getActiveSessions() : [];
        socket.emit("adminDashboard", {
            connected: !!(sock?.authState?.creds?.registered),
            sessions: sessions.length,
            maxSessions: 100,
            commands: getCommandList().length,
            messages: global.messageCount || 0,
            uptime: process.uptime(),
            ngrokUrl: ngUrl,
            platform: os.platform() + " " + os.arch(),
            memUsed: Math.round((os.totalmem()-os.freemem())/1048576),
            memTotal: Math.round(os.totalmem()/1048576),
            commandList: getCommandList()
        });
    });
    socket.on("getAdminLogs", ({ token }) => {
        if (!verifyAdmin(token)) return;
        socket.emit("adminLogs", recentLogs.map(l => l.text));
    });
    socket.on("getAdminSessions", ({ token }) => {
        if (!verifyAdmin(token)) return;
        const sessions = database.getActiveSessions ? database.getActiveSessions() : [];
        socket.emit("adminSessions", sessions);
    });
    socket.on("getEconomy", async ({ token }) => {
        if (!verifyAdmin(token)) return;
        socket.emit("economy", await getEconomyData());
    });
    socket.on("getGroups", ({ token }) => {
        if (!verifyAdmin(token)) return;
        const gs = database.db?.groupSettings || {};
        socket.emit("groups", Object.entries(gs).map(([id,s]) => ({ id, members: s.members||"?", aiMode: s.aiMode||"off", slowMode: s.slowMode||0, antiFlood: s.antiFlood||false })));
    });
    socket.on("getLearning", ({ token }) => {
        if (!verifyAdmin(token)) return;
        const lgAll = learningDB.getAllGroups ? learningDB.getAllGroups() : [];
        socket.emit("learning", lgAll.map(g => ({ id: g.id||"?", topic: g.topic||"-", language: g.language||"-", students: g.students?Object.keys(g.students).length:0, labsDone: g.labsDone||0, aiMode: g.aiMode||"off" })));
    });
    socket.on("getAdminCommands", ({ token }) => {
        if (!verifyAdmin(token)) return;
        socket.emit("adminCommands", getCommandList());
    });
    socket.on("getFiles", ({ token }) => {
        if (token && !verifyAdmin(token)) return;
        const genDir = path.join(__dirname, "public/generated");
        try {
            fsExtra.ensureDirSync(genDir);
            const files = fs.readdirSync(genDir).map(f => {
                const fp = path.join(genDir, f);
                const stat = fs.statSync(fp);
                return { name: f, size: fmtBytes(stat.size), mtime: stat.mtimeMs, url: (ngrokManager.getUrl()||"http://localhost:"+PORT)+"/generated/"+f };
            }).sort((a,b) => b.mtime - a.mtime);
            socket.emit("files", files);
        } catch(e) { socket.emit("files", []); }
    });
    socket.on("getNgrok", ({ token }) => {
        if (token && !verifyAdmin(token)) return;
        socket.emit("ngrokData", { running: ngrokManager.isRunning(), url: ngrokManager.getUrl() });
    });
    socket.on("getConfig", ({ token }) => {
        if (!verifyAdmin(token)) return;
        socket.emit("configData", { autoRead: config.autoRead, autoStatus: config.autoStatus, openPairing: config.openPairing, ngrokEnabled: config.ngrokEnabled !== false });
    });

    socket.on("adminAction", async ({ token, action, payload = {} }) => {
        if (!verifyAdmin(token)) return socket.emit("adminAction", { success: false, error: "Not authorized" });
        try {
            switch(action) {
                case "restart":
                    socket.emit("adminAction", { success: true, message: "Restarting in 2s..." });
                    setTimeout(() => process.exit(0), 2000); break;
                case "shutdown":
                    socket.emit("adminAction", { success: true, message: "Shutting down..." });
                    setTimeout(() => process.exit(1), 1000); break;
                case "clearSessions":
                    if (database.clearAllSessions) database.clearAllSessions();
                    socket.emit("adminAction", { success: true, message: "All sessions cleared." }); break;
                case "reloadCommands":
                    socket.emit("adminAction", { success: true, message: "Commands reloaded (restart for full effect)." }); break;
                case "cleanFiles": {
                    const genDir = path.join(__dirname, "public/generated");
                    fsExtra.emptyDirSync(genDir);
                    socket.emit("adminAction", { success: true, message: "Generated files cleared." }); break; }
                case "startNgrok": {
                    const url = await ngrokManager.startTunnel(PORT, config.ngrokAuthToken);
                    socket.emit("adminAction", { success: !!url, message: url ? "Tunnel started: "+url : "Failed to start" });
                    socket.emit("ngrokData", { running: ngrokManager.isRunning(), url }); break; }
                case "stopNgrok":
                    await ngrokManager.stopTunnel();
                    socket.emit("adminAction", { success: true, message: "Tunnel stopped." });
                    socket.emit("ngrokData", { running: false, url: null }); break;
                case "testNgrok":
                    socket.emit("adminAction", { success: ngrokManager.isRunning(), message: ngrokManager.getStatus() }); break;
                case "broadcast": {
                    const { msg, target } = payload;
                    if (sock && msg) {
                        const sessions = database.getActiveSessions ? database.getActiveSessions() : [];
                        let sent = 0;
                        for (const s of sessions) {
                            try { await sock.sendMessage(s.jid || s.id, { text: "📢 *Broadcast:*\n\n" + msg + config.footer }); sent++; } catch(e) {}
                        }
                        socket.emit("adminAction", { success: true, message: `Broadcast sent to ${sent} chat(s).` });
                    } break; }
                case "econGive": {
                    const { user, amount } = payload;
                    const econPath = path.join(__dirname, "data/economy.json");
                    const edb = await fsExtra.readJson(econPath).catch(() => ({}));
                    const uid = user.includes("@") ? user : user+"@s.whatsapp.net";
                    if (!edb[uid]) edb[uid] = { balance: 0 };
                    edb[uid].balance = (edb[uid].balance||0) + amount;
                    await fsExtra.writeJson(econPath, edb);
                    socket.emit("adminAction", { success: true, message: `Gave $${amount} to ${user}` }); break; }
                case "econReset": {
                    const { user } = payload;
                    const econPath2 = path.join(__dirname, "data/economy.json");
                    const edb2 = await fsExtra.readJson(econPath2).catch(() => ({}));
                    const uid2 = user.includes("@") ? user : user+"@s.whatsapp.net";
                    delete edb2[uid2];
                    await fsExtra.writeJson(econPath2, edb2);
                    socket.emit("adminAction", { success: true, message: `Economy reset for ${user}` }); break; }
                case "resetEconomy":
                    await fsExtra.writeJson(path.join(__dirname, "data/economy.json"), {});
                    socket.emit("adminAction", { success: true, message: "All economy data reset." }); break;
                case "removeSession": {
                    if (database.removeSession) database.removeSession(payload.id);
                    socket.emit("adminAction", { success: true, message: "Session removed." }); break; }
                case "toggleConfig":
                    config[payload.key] = !config[payload.key];
                    socket.emit("adminAction", { success: true, message: `${payload.key} = ${config[payload.key]}` });
                    socket.emit("configData", { autoRead: config.autoRead, autoStatus: config.autoStatus, openPairing: config.openPairing, ngrokEnabled: config.ngrokEnabled }); break;
                case "changePassword":
                    config.adminPassword = payload.password;
                    socket.emit("adminAction", { success: true, message: "Password updated for this session. Edit config.js to make it permanent." }); break;
                default:
                    socket.emit("adminAction", { success: false, error: "Unknown action: " + action });
            }
        } catch(e) {
            socket.emit("adminAction", { success: false, error: e.message });
        }
    });
});

function getCommandList() {
    const result = [];
    const seen = new Set();
    try {
        const scan = (dir) => {
            fs.readdirSync(dir).forEach(f => {
                const fp = path.join(dir, f);
                if (fs.statSync(fp).isDirectory()) scan(fp);
                else if (f.endsWith(".js")) {
                    try {
                        const ex = require(fp);
                        const cmds = Array.isArray(ex) ? ex : [ex];
                        cmds.forEach(c => { if (c?.name && !seen.has(c.name)) { seen.add(c.name); result.push({ name: c.name, alias: c.alias||[], category: c.category||path.basename(dir), description: c.description||c.desc||"", adminOnly: !!c.adminOnly, ownerOnly: !!c.ownerOnly, groupOnly: !!c.groupOnly }); } });
                    } catch(e) {}
                }
            });
        };
        scan(path.join(__dirname, "commands"));
    } catch(e) {}
    return result;
}

async function getLeaderboardData() {
    try {
        const econPath = path.join(__dirname, "data/economy.json");
        const db = await fsExtra.readJson(econPath).catch(() => ({}));
        return Object.entries(db)
            .filter(([,v]) => typeof v === "object" && v.balance !== undefined)
            .map(([id,u]) => ({ id, name: id.split("@")[0], balance: u.balance||0, bank: u.bank||0, xp: u.xp||0 }))
            .sort((a,b) => (b.balance+b.bank) - (a.balance+a.bank))
            .slice(0, 20);
    } catch(e) { return []; }
}
async function getEconomyData() {
    try {
        const econPath = path.join(__dirname, "data/economy.json");
        const db = await fsExtra.readJson(econPath).catch(() => ({}));
        return Object.entries(db)
            .filter(([,v]) => typeof v === "object" && v.balance !== undefined)
            .map(([id,u]) => ({ id, balance: u.balance||0, bank: u.bank||0, xp: u.xp||0 }))
            .sort((a,b) => (b.balance+b.bank) - (a.balance+a.bank))
            .slice(0, 50);
    } catch(e) { return []; }
}
function getRecentActivity() {
    return recentLogs.slice(-10).map(l => ({ text: l.text.slice(0,80), time: new Date(l.ts).toLocaleTimeString(), icon: l.text.includes("✅")?"✅":l.text.includes("❌")?"❌":l.text.includes("warn")?"⚠️":"📨" })).reverse();
}
function fmtBytes(b) { if(b<1024) return b+"B"; if(b<1048576) return (b/1024).toFixed(1)+"KB"; return (b/1048576).toFixed(1)+"MB"; }

const commands = new Map();
global.botStartTime = Date.now();

const loadCommands = (dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            loadCommands(fullPath);
        } else if (file.endsWith(".js")) {
            try {
                const cmdExport = require(fullPath);
                const cmds = Array.isArray(cmdExport) ? cmdExport : [cmdExport];
                for (const cmd of cmds) {
                    if (!cmd || !cmd.name) continue;
                    commands.set(cmd.name, cmd);
                    if (Array.isArray(cmd.alias)) cmd.alias.forEach(a => commands.set(a, cmd));
                    if (Array.isArray(cmd.aliases)) cmd.aliases.forEach(a => commands.set(a, cmd));
                }
            } catch (e) { console.error(`❌ Error loading ${file}:`, e.message); }
        }
    }
};

async function startGiftAxis() {
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
        console.log(`[Bot ${BOT_INDEX}] Session directory created: ${SESSION_DIR}`);
    }

    const SESSION_ID = process.env.SESSION_ID;
    if (SESSION_ID) {
        const credsPath = path.join(SESSION_DIR, "creds.json");
        if (!fs.existsSync(credsPath)) {
            try {
                const decoded = Buffer.from(SESSION_ID, "base64").toString("utf-8");
                fs.writeFileSync(credsPath, decoded);
                console.log(`✅ [Bot ${BOT_INDEX}] Session restored from SESSION_ID env var`);
            } catch(e) {
                console.error(`❌ [Bot ${BOT_INDEX}] Failed to restore session: ${e.message}`);
            }
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ["Gift Axis Labs", "Chrome", "3.0.0"],
        syncFullHistory: false,
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        getMessage: async (key) => {
            const msg = await store.loadMessage(key.remoteJid, key.id);
            return msg?.message || undefined;
        }
    });

    store.bind(sock.ev);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            try {
                const qrUrl = await QRCode.toDataURL(qr);
                io.emit("qr", qrUrl);
            } catch (_) {}
        }

        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const reasonName = reason === DisconnectReason.loggedOut ? "Logged Out" :
                               reason === DisconnectReason.restartRequired ? "Restart Required" :
                               reason === DisconnectReason.timedOut ? "Timed Out" :
                               `Disconnected (${reason})`;
            console.log(`[Bot ${BOT_INDEX}] ${reasonName}. Reconnecting in 5s...`);
            io.emit("log", `${reasonName}. Reconnecting...`);
            io.emit("status", "🔴 Offline");

            if (reason === DisconnectReason.loggedOut) {
                try {
                    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                    fs.mkdirSync(SESSION_DIR, { recursive: true });
                } catch (_) {}
            }
            setTimeout(() => startGiftAxis(), 5000);

        } else if (connection === "open") {
            console.log(`✅ [Bot ${BOT_INDEX}] GIFT AXIS LABS IS ONLINE on port ${PORT}`);
            io.emit("status", "🟢 Online");
            io.emit("log", "Connected Successfully");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("group-participants.update", async (update) => {
        try {
            if (update.action !== "add") return;
            const groupId = update.id;
            const gs = database.getGroupSettings(groupId);
            if (!gs.antibot) return;
            for (const participant of update.participants) {
                const num = participant.split("@")[0];
                if (num.length > 15 || num.includes("bot")) {
                    try {
                        await sock.groupParticipantsUpdate(groupId, [participant], "remove");
                        await sock.sendMessage(groupId, {
                            text: `🤖 Anti-Bot: @${num} removed!` + config.footer,
                            mentions: [participant]
                        });
                    } catch (_) {}
                }
            }
        } catch (e) {}
    });

    if (config.autoStatus) {
        sock.ev.on("messages.upsert", async (chatUpdate) => {
            try {
                const m = chatUpdate.messages[0];
                if (m.key.remoteJid === "status@broadcast") await sock.readMessages([m.key]);
            } catch (_) {}
        });
    }

    setInterval(async () => {
        if (!sock) return;
        const due = database.getDueReminders();
        for (const r of due) {
            try {
                await sock.sendMessage(r.chatId, { text: `⏰ Reminder: ${r.message}` + config.footer });
            } catch (_) {}
        }
    }, 10000);

    sock.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const sender = m.key.participant || from;
            const type = Object.keys(m.message)[0];
            const body = (type === "conversation") ? m.message.conversation :
                         (type === "extendedTextMessage") ? m.message.extendedTextMessage.text :
                         (type === "imageMessage") ? m.message.imageMessage?.caption || "" :
                         (type === "videoMessage") ? m.message.videoMessage?.caption || "" :
                         (type === "buttonsResponseMessage") ? m.message.buttonsResponseMessage?.selectedButtonId || "" :
                         (type === "listResponseMessage") ? m.message.listResponseMessage?.singleSelectReply?.selectedRowId || "" :
                         "";

            database.trackUser(sender, m.pushName || "Unknown");

            if (database.db.botSleeping && !config.ownerNumber.includes(sender)) return;
            if (config.autoRead) await sock.readMessages([m.key]);

            if (from.endsWith("@g.us")) {
                try {
                    const gs = database.getGroupSettings(from);
                    let isGroupAdmin = false;
                    try {
                        const gMeta = await sock.groupMetadata(from);
                        const sp = gMeta.participants.find(p => p.id === sender);
                        isGroupAdmin = !!(sp?.admin) || config.ownerNumber.includes(sender);
                    } catch (_) {}

                    if (!isGroupAdmin && database.isMemberMuted(from, sender)) {
                        try { await sock.sendMessage(from, { delete: m.key }); } catch (_) {}
                        return;
                    }

                    if (gs.antilink && !isGroupAdmin && body) {
                        const linkRegex = /(https?:\/\/|www\.|bit\.ly|t\.me|wa\.me|chat\.whatsapp\.com)/i;
                        if (linkRegex.test(body)) {
                            try { await sock.sendMessage(from, { delete: m.key }); } catch (_) {}
                            await sock.sendMessage(from, {
                                text: `🔗 Anti-Link: @${sender.split("@")[0]} links are not allowed!` + config.footer,
                                mentions: [sender]
                            });
                            return;
                        }
                    }

                    if (gs.antispam && !isGroupAdmin) {
                        const spamCount = database.trackSpam(from, sender);
                        if (spamCount >= 5) {
                            database.muteMember(from, sender);
                            database.resetSpam(from, sender);
                            try { await sock.sendMessage(from, { delete: m.key }); } catch (_) {}
                            await sock.sendMessage(from, {
                                text: `🚫 Anti-Spam: @${sender.split("@")[0]} auto-muted for spamming!` + config.footer,
                                mentions: [sender]
                            });
                            return;
                        }
                    }

                    if (gs.bannedWords && gs.bannedWords.length > 0 && !isGroupAdmin && body) {
                        const lowerBody = body.toLowerCase();
                        const foundWord = gs.bannedWords.find(w => lowerBody.includes(w));
                        if (foundWord) {
                            try { await sock.sendMessage(from, { delete: m.key }); } catch (_) {}
                            await sock.sendMessage(from, {
                                text: `🚫 Anti-Word: @${sender.split("@")[0]} used a banned word!` + config.footer,
                                mentions: [sender]
                            });
                            return;
                        }
                    }

                    if (gs.antitag && !isGroupAdmin) {
                        const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        if (mentions.length >= 5) {
                            try { await sock.sendMessage(from, { delete: m.key }); } catch (_) {}
                            await sock.sendMessage(from, {
                                text: `🏷️ Anti-Tag: @${sender.split("@")[0]} mass tagging not allowed!` + config.footer,
                                mentions: [sender]
                            });
                            return;
                        }
                    }

                    if (gs.antiviewonce && (type === "viewOnceMessage" || type === "viewOnceMessageV2")) {
                        try {
                            const innerMsg = m.message?.viewOnceMessage?.message || m.message?.viewOnceMessageV2?.message;
                            if (innerMsg) {
                                const innerType = Object.keys(innerMsg)[0];
                                if (innerType === "imageMessage" || innerType === "videoMessage") {
                                    const buffer = await sock.downloadMediaMessage(m);
                                    await sock.sendMessage(from, {
                                        [innerType === "imageMessage" ? "image" : "video"]: buffer,
                                        caption: `👁️ View-once by @${sender.split("@")[0]}` + config.footer,
                                        mentions: [sender]
                                    });
                                }
                            }
                        } catch (_) {}
                    }

                } catch (e) {
                    console.error(`[Bot ${BOT_INDEX}] Group protection error:`, e.message);
                }
            }

            global.messageCount = (global.messageCount || 0) + 1;

            if (from.endsWith("@g.us") && body) {
                try {
                    const afkMod = commands.get("afk");
                    if (afkMod?._afkUsers) {
                        const afkU = afkMod._afkUsers;
                        if (afkU.has(sender) && !body.startsWith(config.prefix+"afk")) {
                            const a = afkU.get(sender); afkU.delete(sender);
                            const dur = Math.floor((Date.now()-a.since)/60000);
                            await sock.sendMessage(from,{text:"👋 Welcome back @"+sender.split("@")[0]+"! (AFK "+dur+"min: "+a.reason+")",mentions:[sender]},{quoted:m});
                        }
                        const taggedMentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
                        for(const tagged of taggedMentions){
                            if(afkU.has(tagged)){const a=afkU.get(tagged);const dur=Math.floor((Date.now()-a.since)/60000);await sock.sendMessage(from,{text:"💤 @"+tagged.split("@")[0]+" is AFK ("+dur+"min): "+a.reason,mentions:[tagged]},{quoted:m});}
                        }
                    }
                } catch(e) {}
                try {
                    const gs2 = database.getGroupSettings ? database.getGroupSettings(from) : {};
                    if(gs2?.autoReplies && !body.startsWith(config.prefix)){
                        const lbody=body.toLowerCase();
                        for(const [kw,resp] of Object.entries(gs2.autoReplies)){if(lbody.includes(kw)){await sock.sendMessage(from,{text:resp},{quoted:m});break;}}
                    }
                } catch(e) {}
                try {
                    const gs3 = database.getGroupSettings ? database.getGroupSettings(from) : {};
                    if(gs3?.slowMode>0&&!isGroupAdmin){
                        const slowMod=commands.get("slowmode");
                        const lm=slowMod?._lastMsg||new Map();
                        const lastTime=lm.get(from+sender)||0;
                        if(Date.now()-lastTime<gs3.slowMode){
                            try{await sock.sendMessage(from,{delete:m.key});}catch(e){}
                            const secs=Math.ceil((gs3.slowMode-(Date.now()-lastTime))/1000);
                            await sock.sendMessage(from,{text:"⏱️ @"+sender.split("@")[0]+" slow mode: wait "+secs+"s.",mentions:[sender]},{quoted:m});
                            return;
                        }
                        lm.set(from+sender,Date.now());
                    }
                } catch(e) {}
                try {
                    const gs4 = database.getGroupSettings ? database.getGroupSettings(from) : {};
                    if(gs4?.antiFlood&&!isGroupAdmin){
                        const floodMod=commands.get("antiflood");const mc=floodMod?._msgCount||new Map();
                        const fkey=from+":"+sender;const now2=Date.now();
                        if(!mc.has(fkey))mc.set(fkey,{count:1,window:now2});
                        else{const fc=mc.get(fkey);if(now2-fc.window>10000){fc.count=1;fc.window=now2;}else{fc.count++;const lim=gs4.antiFloodLimit||5;if(fc.count>lim){try{await sock.sendMessage(from,{delete:m.key});}catch(e){}await sock.sendMessage(from,{text:"🌊 @"+sender.split("@")[0]+" flooding! Muted 60s.",mentions:[sender]},{quoted:m});try{await sock.groupParticipantsUpdate(from,[sender],"demote");}catch(e){}setTimeout(async()=>{try{await sock.groupParticipantsUpdate(from,[sender],"promote");}catch(e){}},60000);fc.count=0;}}}
                    }
                } catch(e) {}
                try {
                    const analyticsMod = commands.get("analytics");
                    if(analyticsMod?.trackMsg) analyticsMod.trackMsg(from,sender,m.pushName||sender.split("@")[0]);
                } catch(e) {}
            }

            if (from.endsWith("@g.us") && learningDB.isLearningGroup(from) && body && !body.startsWith(config.prefix)) {
                const lg      = learningDB.getLearningGroup(from);
                const aiMode  = lg?.aiMode || "auto";

                if (aiMode !== "off") {
                    try {
                        const sName = m.pushName || sender.split("@")[0];
                        learningDB.registerStudent(from, sender, sName);

                        const activeQuiz = learningDB.getActiveQuiz(from);
                        if (activeQuiz && /^[abcd]$/i.test(body.trim())) {
                            const qIndex   = activeQuiz.currentQ;
                            const q        = activeQuiz.questions[qIndex];
                            if (q && activeQuiz.answered?.[qIndex]?.[sender] === undefined) {
                                const answer    = body.trim().toUpperCase();
                                const isCorrect = answer === q.answer;
                                learningDB.recordAnswer(from, sender, sName, qIndex, isCorrect, q.points);
                                if (isCorrect) {
                                    await sock.sendMessage(from, {
                                        text: `✅ *${sName}* got it right! +${q.points} pts 🎉` + config.footer,
                                        mentions: [sender]
                                    }).catch(() => {});
                                } else {
                                    await sock.sendMessage(from, {
                                        text: `❌ *${sName}* — wrong! Keep trying 💪`,
                                        mentions: [sender]
                                    }).catch(() => {});
                                }
                            }
                            return; // handled
                        }

                        if (/^(present|here|i'm here|am here)$/i.test(body.trim()) && lg.classOpen) {
                            const marked = learningDB.markPresent(from, sender, sName);
                            if (marked) {
                                await sock.sendMessage(from, {
                                    text: `✅ *${sName}* marked present! (+5 XP)` + config.footer,
                                    mentions: [sender]
                                }).catch(() => {});
                            }
                            return;
                        }

                        if (learningDB.isStudentMuted(from, sender)) {
                            try { await sock.sendMessage(from, { delete: m.key }); } catch (_) {}
                            return;
                        }

                        if (aiMode === "auto" || aiMode === "suggest") {
                            const throttleKey = `${from}_${sender}`;
                            if (!global._aiThrottle) global._aiThrottle = {};
                            const last = global._aiThrottle[throttleKey] || 0;
                            if (Date.now() - last < 8000) return; // 8s cooldown per user
                            global._aiThrottle[throttleKey] = Date.now();

                            const verdict = await geminiAgent.analyzeMessage(
                                lg.topic, lg.language, lg.sensitivity,
                                sName, body
                            ).catch(() => ({ verdict: "ok" }));

                            learningDB.logAIAction(from, sender, body, verdict.verdict, verdict.reason);

                            if (verdict.verdict === "ok") return;

                            if (aiMode === "suggest") {
                                console.log(`[LearningGroup][SUGGEST] ${sName}: ${verdict.reason}`);
                                return;
                            }

                            if (verdict.verdict === "warn" && verdict.confidence > 0.6) {
                                const warns = learningDB.addWarning(from, sender, verdict.reason, "AI Agent");
                                await sock.sendMessage(from, {
                                    text: `⚠️ @${sName} — *AI Warning* (${warns}/3)\n📝 ${verdict.reason}` + config.footer,
                                    mentions: [sender]
                                }).catch(() => {});

                            } else if (verdict.verdict === "mute_10" && verdict.confidence > 0.7) {
                                learningDB.muteStudent(from, sender, 10 * 60000, verdict.reason, "AI Agent");
                                try { await sock.sendMessage(from, { delete: m.key }); } catch (_) {}
                                await sock.sendMessage(from, {
                                    text: `🔇 @${sName} muted for 10 min by AI.\n📝 ${verdict.reason}` + config.footer,
                                    mentions: [sender]
                                }).catch(() => {});

                            } else if (verdict.verdict === "mute_60" && verdict.confidence > 0.75) {
                                learningDB.muteStudent(from, sender, 60 * 60000, verdict.reason, "AI Agent");
                                try { await sock.sendMessage(from, { delete: m.key }); } catch (_) {}
                                await sock.sendMessage(from, {
                                    text: `🔇 @${sName} muted for 1hr by AI.\n📝 ${verdict.reason}` + config.footer,
                                    mentions: [sender]
                                }).catch(() => {});

                            } else if (verdict.verdict === "kick" && verdict.confidence > 0.9) {
                                try {
                                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                                    await sock.sendMessage(from, {
                                        text: `🚫 @${sName} was removed by AI Agent.\n📝 ${verdict.reason}` + config.footer,
                                        mentions: [sender]
                                    }).catch(() => {});
                                } catch (_) {}
                            }
                        }
                    } catch (e) {
                        console.error(`[Bot ${BOT_INDEX}] Learning AI error:`, e.message);
                    }
                }
            }

            if (!body || !body.startsWith(config.prefix)) return;

            database.trackCommand(sender);

            const reply = (text) => sock.sendMessage(from, { text: text + config.footer }, { quoted: m });
            const sendImage = (url, caption) => sock.sendMessage(from, { image: { url }, caption: caption + config.footer }, { quoted: m });
            const sendSticker = (buffer) => sock.sendMessage(from, { sticker: buffer }, { quoted: m });

            const args = body.slice(config.prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const command = commands.get(cmdName);

            if (command) {
                if (command.ownerOnly && !config.ownerNumber.includes(sender)) {
                    return reply(config.msg.owner);
                }
                if (command.adminOnly || command.groupOnly) {
                    if (!from.endsWith("@g.us")) return reply(config.msg.group);
                    if (command.adminOnly) {
                        try {
                            const groupMetadata = await sock.groupMetadata(from);
                            const participant = groupMetadata.participants.find(p => p.id === sender);
                            if (!participant?.admin) return reply(config.msg.admin);
                        } catch (e) {
                            return reply("❌ Could not verify admin status.");
                        }
                    }
                }
                try {
                    await command.execute(sock, m, args, reply);
                } catch (e) {
                    console.error(`❌ [Bot ${BOT_INDEX}] Error in command ${cmdName}:`, e.message);
                    reply(config.msg.error + `\n\n_${e.message}_`);
                }
            }
        } catch (e) {
            console.error(`[Bot ${BOT_INDEX}] Message handler error:`, e.message);
        }
    });
}

loadCommands(path.join(__dirname, "commands"));
console.log(`📦 [Bot ${BOT_INDEX}] Loaded ${commands.size} commands.`);

server.listen(PORT, "0.0.0.0", async () => {
    console.log(`🌐 [Bot ${BOT_INDEX}] Dashboard running on port ${PORT}`);

    if (config.ngrokEnabled !== false) {
        const publicUrl = await ngrokManager.startTunnel(PORT, config.ngrokAuthToken);
        if (publicUrl) {
            console.log(`🌍 [Bot ${BOT_INDEX}] Public URL: ${publicUrl}`);
            if (config.telegramOwnerId) {
                tgBot.sendMessage(config.telegramOwnerId,
                    `🌍 *Ngrok Tunnel Active*\n\`${publicUrl}\`\n\nDashboard: ${publicUrl}/dashboard`,
                    { parse_mode: "Markdown" }
                ).catch(() => {});
            }
        }
    }

    startGiftAxis();
});

process.on("uncaughtException", (err) => console.error(`[Bot ${BOT_INDEX}] Uncaught Exception:`, err.message));
process.on("unhandledRejection", (err) => console.error(`[Bot ${BOT_INDEX}] Unhandled Rejection:`, err?.message || err));
