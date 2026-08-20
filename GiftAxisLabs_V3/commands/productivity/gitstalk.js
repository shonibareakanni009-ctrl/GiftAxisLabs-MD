module.exports = {
    name: "gitstalk",
    async execute(sock, m, args, reply) {
        if(!args[0]) return reply('👤 Provide GitHub username.'); reply(`🐱 GitHub Profile: https://github.com/${args[0]}`);
    }
};
