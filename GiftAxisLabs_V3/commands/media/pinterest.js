const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "pinterest", alias: ["pin","pindl"],
    async execute(sock, m, args, reply) {
        if (!args.length) return reply("Usage: .pinterest <search term>\nExample: .pinterest aesthetic wallpaper");
        const query = args.join(" ");
        try {
            reply(`🔍 Searching Pinterest for: *${query}*...`);
            const res = await axios.get(`https://api.pinterest.com/v3/pidgets/boards_feed/?board_id=`, { timeout: 10000 }).catch(() => null);
            const imgRes = await axios.get(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${process.env.UNSPLASH_KEY || ""}`, { timeout: 8000 }).catch(() => null);
            const imgUrl = imgRes?.data?.results?.[0]?.urls?.regular;
            if (!imgUrl) {
                return reply(`🖼️ Pinterest Search: *${query}*\n\nVisit: https://pinterest.com/search/pins/?q=${encodeURIComponent(query)}` + config.footer);
            }
            await sock.sendMessage(m.key.remoteJid, { image: { url: imgUrl }, caption: `📌 Pinterest: ${query}` + config.footer }, { quoted: m });
        } catch(e) {
            reply(`📌 Pinterest Search: *${query}*\n\n🔗 https://pinterest.com/search/pins/?q=${encodeURIComponent(query)}` + config.footer);
        }
    }
};
