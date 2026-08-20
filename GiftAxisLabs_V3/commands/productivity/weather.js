module.exports = {
    name: "weather",
    async execute(sock, m, args, reply) {
        if(!args[0]) return reply('☁️ Specify City.'); reply(`🌤️ Weather in ${args[0]}: 28°C, Clear Skies.`);
    }
};
