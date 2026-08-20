const config = require("../../config");

module.exports = {
    name: "tagall",
    alias: ["everyone", "all"],
    desc: "Mentions every single member in a group.",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid;
        const customMsg = args.length > 0 ? args.join(" ") : "📢 Attention Everyone!";

        try {
            const group = await sock.groupMetadata(from);
            const participants = group.participants;

            let text = `┌ ❏ ◆ ⌜𝗧𝗔𝗚 𝗔𝗟𝗟⌟ ◆\n│\n`;
            text += `├◆ 📢 ${customMsg}\n│\n`;

            participants.forEach(p => {
                text += `├◆ @${p.id.split("@")[0]}\n`;
            });

            text += `│\n└ ❏`;

            await sock.sendMessage(from, {
                text: text + config.footer,
                mentions: participants.map(p => p.id)
            }, { quoted: m });
        } catch (e) {
            reply("❌ Failed to tag members: " + e.message);
        }
    }
};
