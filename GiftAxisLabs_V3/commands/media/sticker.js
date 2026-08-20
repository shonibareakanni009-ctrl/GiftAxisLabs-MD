const config = require("../../config");
module.exports = {
    name: "sticker", alias: ["s","stk"],
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const from = m.key.remoteJid;
        const imgMsg = m.message?.imageMessage || quoted?.imageMessage || m.message?.videoMessage || quoted?.videoMessage;
        if (!imgMsg) return reply("❌ Reply to an *image or video* with .sticker");
        try {
            reply("⏳ Creating sticker...");
            const stream = await sock.downloadMediaMessage(m);
            await sock.sendMessage(from, { sticker: stream }, { quoted: m });
        } catch(e) { reply("❌ Failed: " + e.message); }
    }
};
