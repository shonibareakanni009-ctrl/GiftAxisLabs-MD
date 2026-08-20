const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "twitter", alias: ["x","tweet","xdl"],
    async execute(sock, m, args, reply) {
        const url = args[0];
        if (!url || (!url.includes("twitter") && !url.includes("x.com"))) return reply("Usage: .twitter <tweet url>");
        try {
            reply("⏳ Fetching tweet media...");
            const res = await axios.get(`https://twdown.net/download.php?URL=${encodeURIComponent(url)}`, { timeout: 15000 }).catch(() => null);
            if (!res) return reply("❌ Could not download tweet media. Only tweets with videos/images are supported.");
            reply("❌ Twitter/X media downloads require authentication due to API changes.\n💡 Tip: Use a browser extension like DownloadThisVideo for Twitter media." + config.footer);
        } catch(e) { reply("❌ " + e.message); }
    }
};
