module.exports = {
    name: "binary",
    async execute(sock, m, args, reply) {
        const bin = args.join(' ').split('').map(c => c.charCodeAt(0).toString(2)).join(' '); reply('🔢 Binary: ' + bin);
    }
};
