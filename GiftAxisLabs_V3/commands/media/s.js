const config = require("../../config");
module.exports = {
    name: "s", alias: ["stk2"],
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imgMsg = m.message?.imageMessage || quoted?.imageMessage;
        if (!imgMsg) return reply("❌ Reply to an *image* with .s");
        try {
            const stream = await sock.downloadMediaMessage(m);
            await sock.sendMessage(m.key.remoteJid, { sticker: stream }, { quoted: m });
        } catch(e) { reply("❌ " + e.message); }
    }
};
