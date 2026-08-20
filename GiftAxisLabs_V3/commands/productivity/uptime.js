module.exports = {
    name: "uptime",
    async execute(sock, m, args, reply) {
        reply('⏳ Bot Uptime: ' + process.uptime().toFixed(0) + ' seconds.');
    }
};
