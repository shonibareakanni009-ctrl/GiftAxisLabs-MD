const config = require("../../config");

module.exports = {
    name: "unmute",
    desc: "Opens the group so all members can send messages.",
    adminOnly: true,
    groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid;
        await sock.groupSettingUpdate(from, 'not_announcement');
        reply(
            `┌ ❏ ◆ ⌜🔓 𝗚𝗥𝗢𝗨𝗣 𝗢𝗣𝗘𝗡𝗘𝗗⌟ ◆\n│\n` +
            `├◆ 🔓 ɢʀᴏᴜᴘ ɪs ɴᴏᴡ ᴏᴘᴇɴ\n` +
            `├◆ ᴀʟʟ ᴍᴇᴍʙᴇʀs ᴄᴀɴ sᴇɴᴅ ᴍsɢs\n│\n└ ❏`
        );
    }
};
