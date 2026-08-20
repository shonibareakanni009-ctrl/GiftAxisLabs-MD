module.exports = {
    name: "notes",
    async execute(sock, m, args, reply) {
        reply('🗒️ Note Saved: ' + args.join(' '));
    }
};
