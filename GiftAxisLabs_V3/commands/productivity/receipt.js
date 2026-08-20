module.exports = {
    name: "receipt",
    async execute(sock, m, args, reply) {
        reply('📝 Digital Receipt created for: ' + (args.join(' ') || 'General Purchase'));
    }
};
