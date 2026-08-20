const config = require("../../config");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "save",
    alias: ["dl", "download"],
    desc: "Downloads replied media directly to the server PC.",
    ownerOnly: true,
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return reply("📎 *Reply to media* (image/video/audio/document) with .save");
        }

        const mediaType = Object.keys(quoted)[0];
        const validTypes = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];

        if (!validTypes.includes(mediaType)) {
            return reply("❌ Reply to an image, video, audio, sticker, or document.");
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

            let ext;
            switch (mediaType) {
                case "imageMessage": ext = ".jpg"; break;
                case "videoMessage": ext = ".mp4"; break;
                case "audioMessage": ext = ".mp3"; break;
                case "stickerMessage": ext = ".webp"; break;
                case "documentMessage":
                    ext = "." + (quoted.documentMessage?.fileName?.split(".").pop() || "bin");
                    break;
                default: ext = ".bin";
            }

            const saveDir = path.join(__dirname, "..", "..", "downloads");
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir, { recursive: true });
            }

            const filename = `saved_${Date.now()}${ext}`;
            const filepath = path.join(saveDir, filename);
            fs.writeFileSync(filepath, buffer);

            const sizeKB = (buffer.length / 1024).toFixed(1);
            const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
            const sizeStr = buffer.length > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

            reply(
                `┌ ❏ ◆ ⌜𝗦𝗔𝗩𝗘𝗗⌟ ◆\n` +
                `│\n` +
                `├◆ ✅ Media saved to server\n` +
                `├◆ 📁 ${filename}\n` +
                `├◆ 📊 Size: ${sizeStr}\n` +
                `├◆ 📂 Path: downloads/${filename}\n` +
                `│\n` +
                `└ ❏`
            );
        } catch (e) {
            console.error("save error:", e.message);
            reply("❌ Save failed: " + e.message);
        }
    }
};
