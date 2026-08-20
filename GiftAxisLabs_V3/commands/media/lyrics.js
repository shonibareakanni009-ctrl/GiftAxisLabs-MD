const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "lyrics", alias: ["lyric","song-lyrics"],
    async execute(sock, m, args, reply) {
        if (!args.length) return reply("Usage: .lyrics <artist> - <song>\nExample: .lyrics Ed Sheeran - Shape of You");
        const raw = args.join(" ");
        const [artistPart, ...songParts] = raw.split("-");
        const artist = artistPart?.trim();
        const title  = songParts.join("-").trim();
        if (!artist || !title) return reply("Usage: .lyrics <artist> - <song title>");
        try {
            reply(`🎵 Searching lyrics for *${title}* by *${artist}*...`);
            const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { timeout: 10000 });
            const lyrics = res.data.lyrics?.slice(0, 3000) || "Lyrics not found.";
            const truncated = res.data.lyrics?.length > 3000 ? "\n\n_...lyrics truncated_" : "";
            await sock.sendMessage(m.key.remoteJid, {
                text: `🎵 *${title}* — ${artist}\n\n${lyrics}${truncated}` + config.footer
            }, { quoted: m });
        } catch(e) {
            reply(`❌ Lyrics not found for "${title}" by "${artist}"`);
        }
    }
};
