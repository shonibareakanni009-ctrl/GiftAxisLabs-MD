const config = require("../../config");
module.exports = {
    name: "tomp4", alias: ["tovideo"],
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const vidMsg = m.message?.videoMessage || quoted?.videoMessage;
        if (!vidMsg) return reply("❌ Reply to a *video* with .tomp4");
        try {
            reply("⏳ Processing...");
            const buffer = await sock.downloadMediaMessage(m);
            await sock.sendMessage(m.key.remoteJid, {
                video: buffer, caption: "🎬 Video" + config.footer
            }, { quoted: m });
        } catch(e) { reply("❌ " + e.message); }
    }
};
