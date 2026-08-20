module.exports = {
    name: "link",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        const code = await sock.groupInviteCode(m.key.remoteJid); reply('🔗 https://chat.whatsapp.com/' + code);
    }
};
