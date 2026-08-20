module.exports = {
    name: "base64",
    async execute(sock, m, args, reply) {
        const b64 = Buffer.from(args.join(' ')).toString('base64'); reply('🔗 Base64: ' + b64);
    }
};
