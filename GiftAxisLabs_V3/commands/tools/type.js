const config = require("../../config");

module.exports = {
    name: "type",
    alias: ["t"],
    desc: "Simulates typing then sends a stylized message box.",
    async execute(sock, m, args, reply) {
        if (!args.length) {
            return reply("┌ ❏ ◆ ⌜𝗧𝗬𝗣𝗘⌟ ◆\n│\n├◆ ᴜsᴀɢᴇ: .type [message]\n├◆ ᴇxᴀᴍᴘʟᴇ: .type Hello World\n│\n└ ❏");
        }

        const from = m.key.remoteJid;
        const text = args.join(" ");

        await sock.sendPresenceUpdate("composing", from);

        const delay = Math.min(Math.max(text.length * 50, 1000), 5000);
        await new Promise(r => setTimeout(r, delay));

        await sock.sendPresenceUpdate("paused", from);

        const boxText =
            `┌ ❏ ◆ ⌜${config.botName}⌟ ◆\n` +
            `│\n` +
            `├◆ ${text}\n` +
            `│\n` +
            `└ ❏`;

        await sock.sendMessage(from, { text: boxText + config.footer }, { quoted: m });
    }
};
