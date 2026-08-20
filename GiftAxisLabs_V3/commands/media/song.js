const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "song", alias: ["music","yt"],
    async execute(sock, m, args, reply) {
        if (!args.length) return reply("Usage: .song <song name>\nExample: .song Burna Boy Last Last");
        const query = args.join(" ");
        try {
            reply(`🎵 Looking up *${query}*...`);
            const searchRes = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { timeout: 10000 });
            const matches = [...searchRes.data.matchAll(/"videoId":"([^"]+)"/g)].slice(0, 3);
            if (!matches.length) return reply("❌ No results found.");
            const results = matches.map(m => `▶️ https://youtu.be/${m[1]}`).join("\n");
            reply(`🎵 Results for *${query}*:\n\n${results}\n\nUse .play for direct audio link` + config.footer);
        } catch(e) { reply("❌ " + e.message); }
    }
};
