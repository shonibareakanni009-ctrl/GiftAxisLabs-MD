const config = require("../../config");
const database = require("../../lib/database");

module.exports = {
    name: "remind",
    alias: ["reminder", "remindme"],
    desc: "Sets a timer (s/m/h/d) and alerts you when finished.",
    async execute(sock, m, args, reply) {
        if (args.length < 2) {
            return reply(
                "┌ ❏ ◆ ⌜⏰ 𝗥𝗘𝗠𝗜𝗡𝗗𝗘𝗥⌟ ◆\n│\n" +
                "├◆ ᴜsᴀɢᴇ: .remind [time] [message]\n" +
                "├◆ ᴛɪᴍᴇ ғᴏʀᴍᴀᴛs:\n" +
                "├◆  30s = 30 seconds\n" +
                "├◆  5m  = 5 minutes\n" +
                "├◆  2h  = 2 hours\n" +
                "├◆  1d  = 1 day\n" +
                "├◆ ᴇxᴀᴍᴘʟᴇ: .remind 10m Take a break\n│\n└ ❏"
            );
        }

        const timeStr = args[0].toLowerCase();
        const message = args.slice(1).join(" ");

        const match = timeStr.match(/^(\d+)(s|m|h|d)$/);
        if (!match) {
            return reply("❌ Invalid time format. Use: 30s, 5m, 2h, or 1d");
        }

        const amount = parseInt(match[1]);
        const unit = match[2];

        let ms;
        let unitName;
        switch (unit) {
            case "s": ms = amount * 1000; unitName = "second(s)"; break;
            case "m": ms = amount * 60 * 1000; unitName = "minute(s)"; break;
            case "h": ms = amount * 60 * 60 * 1000; unitName = "hour(s)"; break;
            case "d": ms = amount * 24 * 60 * 60 * 1000; unitName = "day(s)"; break;
        }

        if (ms > 7 * 24 * 60 * 60 * 1000) {
            return reply("❌ Maximum reminder time is 7 days.");
        }

        const from = m.key.remoteJid;
        const sender = m.key.participant || from;
        const triggerAt = Date.now() + ms;

        database.addReminder(sender, from, message, triggerAt);

        reply(
            `┌ ❏ ◆ ⌜𝗥𝗘𝗠𝗜𝗡𝗗𝗘𝗥 𝗦𝗘𝗧⌟ ◆\n` +
            `│\n` +
            `├◆ ⏰ I'll remind you in ${amount} ${unitName}\n` +
            `├◆ 📝 "${message}"\n` +
            `│\n` +
            `└ ❏`
        );
    }
};
