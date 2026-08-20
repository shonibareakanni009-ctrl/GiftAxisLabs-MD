module.exports = {
    name: "revoke",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        const code = await sock.groupRevokeInvite(m.key.remoteJid); reply('🔗 Link Revoked.');
    }
};
