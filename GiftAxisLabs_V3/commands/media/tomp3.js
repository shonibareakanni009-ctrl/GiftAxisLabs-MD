const config = require("../../config");
module.exports = {
    name: "tomp3", alias: ["toaudio","extractaudio"],
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const videoMsg = m.message?.videoMessage || quoted?.videoMessage;
        if (!videoMsg) return reply("❌ Reply to a *video* with .tomp3");
        try {
            reply("⏳ Extracting audio...");
            const buffer = await sock.downloadMediaMessage(m);
            await sock.sendMessage(m.key.remoteJid, {
                audio: buffer, mimetype: "audio/mp4", ptt: false
            }, { quoted: m });
        } catch(e) { reply("❌ " + e.message); }
    }
};
