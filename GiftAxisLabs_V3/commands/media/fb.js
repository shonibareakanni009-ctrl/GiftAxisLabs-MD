const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "fb", alias: ["facebook","fbdl"],
    async execute(sock, m, args, reply) {
        const url = args[0];
        if (!url || !url.includes("facebook")) return reply("Usage: .fb <facebook video url>");
        try {
            reply("⏳ Fetching Facebook video...");
            const res = await axios.get(`https://fb-downloader-api.vercel.app/api?url=${encodeURIComponent(url)}`, { timeout: 15000 }).catch(() => null);
            if (!res?.data?.links?.length) return reply("❌ Could not extract Facebook video.\n💡 Make sure the video is public and the URL is direct.");
            const hdLink = res.data.links.find(l => l.quality?.includes("HD"))?.link || res.data.links[0]?.link;
            if (!hdLink) return reply("❌ No downloadable link found.");
            await sock.sendMessage(m.key.remoteJid, {
                video: { url: hdLink },
                caption: "📹 Downloaded from Facebook" + config.footer
            }, { quoted: m });
        } catch(e) { reply("❌ " + e.message); }
    }
};
