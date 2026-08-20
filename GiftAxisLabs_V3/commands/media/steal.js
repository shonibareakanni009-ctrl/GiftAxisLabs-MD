const config = require("../../config");
module.exports = {
    name: "steal", alias: ["grabsticker"],
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stickerMsg = m.message?.stickerMessage || quoted?.stickerMessage;
        if (!stickerMsg) return reply("❌ Reply to a *sticker* with .steal");
        try {
            const buffer = await sock.downloadMediaMessage(m);
            await sock.sendMessage(m.key.remoteJid, { sticker: buffer }, { quoted: m });
            reply("✅ Sticker stolen to your collection!" + config.footer);
        } catch(e) { reply("❌ " + e.message); }
    }
};
