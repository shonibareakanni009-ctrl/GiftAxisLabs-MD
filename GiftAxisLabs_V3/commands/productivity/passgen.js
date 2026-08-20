module.exports = {
    name: "passgen",
    async execute(sock, m, args, reply) {
        const pass = Math.random().toString(36).slice(-10) + Math.random().toString(36).toUpperCase().slice(-5); reply('🔐 Secure Password: ' + pass);
    }
};
