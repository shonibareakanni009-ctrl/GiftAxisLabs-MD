const os = require("os");
module.exports = {
    name: "status",
    alias: ["stats"],
    async execute(sock, m, args, reply) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const secs = Math.floor(uptime % 60);
        const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        reply(`📊 *Bot Status*\n\n⏰ Uptime: ${hours}h ${mins}m ${secs}s\n💾 RAM: ${memUsed} MB\n🖥️ Platform: ${os.platform()}\n📦 Node: ${process.version}\n🟢 Status: Online`);
    }
};
