const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "tiktok", alias: ["tt","ttdl"],
    async execute(sock, m, args, reply) {
        const url = args[0];
        if (!url || !url.includes("tiktok")) return reply("Usage: .tiktok <tiktok url>");
        try {
            reply("⏳ Downloading TikTok...");
            const api = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;
            const res = await axios.get(api, { timeout: 15000 });
            const data = res.data?.data;
            if (!data?.play) return reply("❌ Could not download. Try another URL.");
            await sock.sendMessage(m.key.remoteJid, {
                video: { url: data.play },
                caption: `🎵 ${data.title || "TikTok Video"}\n👤 ${data.author?.nickname || ""}\n❤️ ${data.digg_count || 0} | 💬 ${data.comment_count || 0}` + config.footer
            }, { quoted: m });
        } catch(e) { reply("❌ Download failed: " + e.message); }
    }
};
