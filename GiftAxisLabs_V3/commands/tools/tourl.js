const config = require("../../config");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const axios = require("axios");
const FormData = require("form-data");

module.exports = {
    name: "tourl",
    alias: ["upload", "url"],
    desc: "Converts a replied image/video into a permanent link.",
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return reply("📎 *Reply to an image or video* with .tourl to get a link.");
        }

        const mediaType = Object.keys(quoted)[0];
        if (!["imageMessage", "videoMessage", "documentMessage", "audioMessage"].includes(mediaType)) {
            return reply("❌ Reply to an image, video, audio, or document only.");
        }

        reply(config.msg.wait);

        try {
            const buffer = await downloadMediaMessage(
                { message: quoted, key: m.key },
                "buffer",
                {}
            );

            if (!buffer) {
                return reply("❌ Failed to download media.");
            }

            let url;

            if (mediaType === "imageMessage") {
                const form = new FormData();
                form.append("file", buffer, { filename: "image.jpg", contentType: "image/jpeg" });

                const res = await axios.post("https://telegra.ph/upload", form, {
                    headers: form.getHeaders()
                });

                if (res.data && res.data[0]?.src) {
                    url = "https://telegra.ph" + res.data[0].src;
                }
            }

            if (!url) {
                const form = new FormData();
                form.append("reqtype", "fileupload");
                form.append("fileToUpload", buffer, {
                    filename: mediaType === "videoMessage" ? "video.mp4" :
                              mediaType === "audioMessage" ? "audio.mp3" : "file.bin",
                    contentType: "application/octet-stream"
                });

                const res = await axios.post("https://catbox.moe/user/api.php", form, {
                    headers: form.getHeaders()
                });

                url = res.data;
            }

            if (url) {
                reply(
                    `┌ ❏ ◆ ⌜𝗨𝗣𝗟𝗢𝗔𝗗 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘⌟ ◆\n` +
                    `│\n` +
                    `├◆ ✅ Media uploaded!\n` +
                    `├◆ 🔗 ${url}\n` +
                    `│\n` +
                    `└ ❏`
                );
            } else {
                reply("❌ Upload failed. Try again later.");
            }
        } catch (e) {
            console.error("tourl error:", e.message);
            reply("❌ Upload failed: " + e.message);
        }
    }
};
