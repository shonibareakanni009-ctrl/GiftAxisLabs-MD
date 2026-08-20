const config = require("../../config");
module.exports = {
    name: "owner",
    async execute(sock, m, args, reply) {
        try {
            await sock.sendMessage(m.key.remoteJid, {
                contacts: {
                    displayName: config.ownerName,
                    contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${config.ownerName}\nTEL;type=CELL;type=VOICE;waid=${config.pairingNumber}:+${config.pairingNumber}\nEND:VCARD` }]
                }
            }, { quoted: m });
        } catch (e) {
            reply(`👑 *Owner:* ${config.ownerName}\n📞 *Number:* +${config.pairingNumber}`);
        }
    }
};
