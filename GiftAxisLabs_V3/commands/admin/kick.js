module.exports = {
    name: "kick",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        if(!m.message.extendedTextMessage?.contextInfo?.participant) return reply('Reply to a user.'); await sock.groupParticipantsUpdate(m.key.remoteJid, [m.message.extendedTextMessage.contextInfo.participant], 'remove'); reply('👋 User Kicked.');
    }
};
