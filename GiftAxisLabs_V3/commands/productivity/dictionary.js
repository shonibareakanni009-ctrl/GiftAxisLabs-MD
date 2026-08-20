module.exports = {
    name: "dictionary",
    async execute(sock, m, args, reply) {
        reply(`📖 Defining: ${args[0] || 'Nothing'}... (Logic linked to API)`);
    }
};
