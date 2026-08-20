const config = require("../../config");
const axios = require("axios");
const FormData = require("form-data");
module.exports = {
    name: "upload", alias: ["hostfile","imghost"],
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imgMsg = m.message?.imageMessage || quoted?.imageMessage || m.message?.videoMessage || quoted?.videoMessage || m.message?.audioMessage || quoted?.audioMessage;
        if (!imgMsg) return reply("❌ Reply to a *media message* (image/video/audio) with .upload");
        try {
            reply("⏳ Uploading to catbox.moe...");
            const buffer = await sock.downloadMediaMessage(m);
            const form = new FormData();
            form.append("reqtype", "fileupload");
            form.append("fileToUpload", buffer, { filename: "media.bin" });
            const res = await axios.post("https://catbox.moe/user.php", form, {
                headers: form.getHeaders(), timeout: 30000
            });
            if (res.data?.startsWith("https://")) {
                reply(`✅ *Uploaded!*\n🔗 ${res.data.trim()}` + config.footer);
            } else {
                reply("❌ Upload failed. Try again.");
            }
        } catch(e) { reply("❌ Upload error: " + e.message); }
    }
};
