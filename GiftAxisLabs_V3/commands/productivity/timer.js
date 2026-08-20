module.exports = {
    name: "timer",
    async execute(sock, m, args, reply) {
        reply(`⏲️ Timer started for ${args[0] || '1 minute'}.`);
    }
};
