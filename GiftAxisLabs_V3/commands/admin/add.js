module.exports = {
    name: "add",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        if(!args[0]) return reply('Provide a number.'); await sock.groupParticipantsUpdate(m.key.remoteJid, [args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'], 'add'); reply('➕ User Added.');
    }
};
