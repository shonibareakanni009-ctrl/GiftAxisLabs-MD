const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "play", alias: ["ytplay","ytsong"],
    async execute(sock, m, args, reply) {
        if (!args.length) return reply("Usage: .play <song name>\nExample: .play Afrobeats 2024");
        const query = args.join(" ");
        try {
            reply(`🎵 Searching for *${query}*...`);
            const searchRes = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { timeout: 10000 });
            const match = searchRes.data.match(/"videoId":"([^"]+)"/);
            if (!match) return reply("❌ No results found.");
            const videoId = match[1];
            const infoRes = await axios.get(`https://www.youtube.com/oembed?url=https://youtu.be/${videoId}&format=json`, { timeout: 5000 }).catch(() => null);
            const title = infoRes?.data?.title || query;
            reply(
                `🎵 *${title}*\n\n▶️ https://youtu.be/${videoId}\n\n💡 To auto-download audio, install ytdl-core:\n\`npm install ytdl-core\`\nThen .play will send the audio directly!` + config.footer
            );
        } catch(e) { reply("❌ " + e.message); }
    }
};
