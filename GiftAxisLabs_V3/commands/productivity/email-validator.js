module.exports = {
    name: "email-validator",
    async execute(sock, m, args, reply) {
        const valid = args[0] && args[0].includes('@'); reply(valid ? '✅ Email is valid format.' : '❌ Invalid Email.');
    }
};
