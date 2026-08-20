const config = require("../../config");
module.exports = {
    name: "toimg", alias: ["stickertoimg","unpack"],
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stickerMsg = m.message?.stickerMessage || quoted?.stickerMessage;
        if (!stickerMsg) return reply("❌ Reply to a *sticker* with .toimg");
        try {
            const buffer = await sock.downloadMediaMessage(m);
            await sock.sendMessage(m.key.remoteJid, { image: buffer, caption: "🖼️ Sticker converted to image" + config.footer }, { quoted: m });
        } catch(e) { reply("❌ " + e.message); }
    }
};
