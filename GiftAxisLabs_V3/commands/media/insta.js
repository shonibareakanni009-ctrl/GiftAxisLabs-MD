const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "insta", alias: ["ig","instagram"],
    async execute(sock, m, args, reply) {
        const url = args[0];
        if (!url || !url.includes("instagram")) return reply("Usage: .insta <instagram post/reel url>");
        try {
            reply("⏳ Fetching Instagram media...");
            const res = await axios.get(`https://instaloader.netlify.app/api/instagram?url=${encodeURIComponent(url)}`, { timeout: 15000 }).catch(() => null);
            if (!res?.data?.url) {
                return reply("❌ Could not download Instagram media.\n💡 Try saving it manually or use a different post URL.");
            }
            const mediaUrl = res.data.url;
            const isVideo = res.data.type === "video";
            await sock.sendMessage(m.key.remoteJid, {
                [isVideo ? "video" : "image"]: { url: mediaUrl },
                caption: "📸 Downloaded from Instagram" + config.footer
            }, { quoted: m });
        } catch(e) { reply("❌ Instagram download failed: " + e.message); }
    }
};
