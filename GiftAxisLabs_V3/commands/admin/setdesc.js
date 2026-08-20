module.exports = {
    name: "setdesc",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        if(!args[0]) return reply('Provide text.'); await sock.groupUpdateDescription(m.key.remoteJid, args.join(' ')); reply('✅ Desc Updated.');
    }
};
