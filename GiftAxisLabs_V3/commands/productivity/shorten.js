const config = require("../../config");
const axios = require("axios");
module.exports = {
    name: "shorten", alias: ["tinyurl","shortlink"],
    async execute(sock, m, args, reply) {
        const url = args[0];
        if (!url || !url.startsWith("http")) return reply("Usage: .shorten <url>\nExample: .shorten https://google.com");
        try {
            const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 8000 });
            reply(`┌ ❏ ◆ ⌜🔗 𝗨𝗥𝗟 𝗦𝗛𝗢𝗥𝗧𝗘𝗡𝗘𝗥⌟ ◆\n│\n├◆ 🔗 Short: ${res.data}\n├◆ 📎 Original: ${url.slice(0,50)}...\n└ ❏` + config.footer);
        } catch(e) { reply("❌ Could not shorten URL: " + e.message); }
    }
};
