module.exports = {
    name: "hidetag",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        const group = await sock.groupMetadata(m.key.remoteJid); sock.sendMessage(m.key.remoteJid, { text: args.join(' ') || '📢', mentions: group.participants.map(p => p.id) });
    }
};
