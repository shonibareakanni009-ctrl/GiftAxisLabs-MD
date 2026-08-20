const config = require("../../config");

module.exports = {
    name: "voicechat",
    alias: ["vc", "call"],
    desc: "Triggers a 'Join Voice Chat' banner in the group.",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid;
        const action = args[0]?.toLowerCase() || "open";

        try {
            if (action === "open" || action === "start") {
                await sock.sendMessage(from, {
                    groupCallMessage: {
                        callKey: Buffer.alloc(32),
                        callCreatorJid: m.key.participant || from,
                        scheduledCallTs: 0
                    }
                });

                reply(
                    `┌ ❏ ◆ ⌜𝗩𝗢𝗜𝗖𝗘 𝗖𝗛𝗔𝗧⌟ ◆\n` +
                    `│\n` +
                    `├◆ 🎙️ Voice chat started!\n` +
                    `├◆ Members can now join\n` +
                    `│\n` +
                    `└ ❏`
                );
            } else if (action === "close" || action === "end") {
                reply(
                    `┌ ❏ ◆ ⌜𝗩𝗢𝗜𝗖𝗘 𝗖𝗛𝗔𝗧⌟ ◆\n` +
                    `│\n` +
                    `├◆ 🔇 Voice chat ended\n` +
                    `│\n` +
                    `└ ❏`
                );
            } else {
                reply("📝 *Usage:* .voicechat open/close");
            }
        } catch (e) {
            reply("❌ Voice chat error: " + e.message);
        }
    }
};
