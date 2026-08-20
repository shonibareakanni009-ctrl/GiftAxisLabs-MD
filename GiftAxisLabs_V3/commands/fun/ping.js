const os = require("os");

module.exports = {
    name: "ping",
    alias: ["p", "speed"],
    desc: "Checks server latency and response speed.",
    async execute(sock, m, args, reply) {
        const start = Date.now();
        await sock.sendMessage(m.key.remoteJid, { text: "🏓 *Pinging...*" }, { quoted: m });
        const latency = Date.now() - start;

        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const secs = Math.floor(uptime % 60);

        const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024).toFixed(0);
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);

        const speed = latency < 100 ? "⚡ Excellent" :
                      latency < 300 ? "🟢 Good" :
                      latency < 600 ? "🟡 Average" : "🔴 Slow";

        reply(
            `┌ ❏ ◆ ⌜𝗣𝗜𝗡𝗚⌟ ◆\n` +
            `│\n` +
            `├◆ 🏓 ᴘᴏɴɢ!\n` +
            `├◆ ⚡ ʟᴀᴛᴇɴᴄʏ: ${latency}ms\n` +
            `├◆ 📊 sᴘᴇᴇᴅ: ${speed}\n` +
            `├◆ ⏱️ ᴜᴘᴛɪᴍᴇ: ${hours}h ${mins}m ${secs}s\n` +
            `├◆ 💾 ʀᴀᴍ: ${usedMem}MB / ${totalMem}MB\n` +
            `│\n` +
            `└ ❏`
        );
    }
};
