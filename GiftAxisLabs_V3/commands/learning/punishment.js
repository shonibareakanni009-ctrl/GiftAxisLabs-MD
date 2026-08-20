

const ldb    = require("../../lib/learningDB");
const config = require("../../config");

const MUTE_DURATIONS = {
    "10m":  10  * 60 * 1000,
    "30m":  30  * 60 * 1000,
    "1h":   60  * 60 * 1000,
    "3h":   3   * 60 * 60 * 1000,
    "24h":  24  * 60 * 60 * 1000,
};

module.exports = [

    {
        name:        "warn",
        aliases:     ["warning", "addwarn"],
        description: "Warn a student (3 warns = kick)",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        async execute(sock, m, args, reply) {
            const from    = m.key.remoteJid;
            const sender  = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const reason   = args.filter(a => !a.includes("@")).join(" ") || "No reason given";

            if (!mentions.length) return reply("Usage: .warn @user <reason>");

            for (const userId of mentions) {
                ldb.registerStudent(from, userId, userId.split("@")[0]);
                const warns = ldb.addWarning(from, userId, reason, sender);
                const name  = userId.split("@")[0];

                let action = "";
                if (warns >= 3) {
                    try {
                        await sock.groupParticipantsUpdate(from, [userId], "remove");
                        action = "\n├◆ 🚫 *AUTO-KICKED* (3 warnings reached)";
                    } catch (e) {
                        action = "\n├◆ ⚠️ Could not auto-kick — remove manually";
                    }
                } else if (warns === 2) {
                    action = `\n├◆ ⚠️ *1 more warn = KICK*`;
                }

                await sock.sendMessage(from, {
                    text:
                        `┌ ❏ ◆ ⌜⚠️ 𝗪𝗔𝗥𝗡𝗜𝗡𝗚⌟ ◆\n│\n` +
                        `├◆ 👤 @${name}\n` +
                        `├◆ 📝 Reason: ${reason}\n` +
                        `├◆ ⚠️ Warnings: ${warns}/3` +
                        action + `\n└ ❏` + config.footer,
                    mentions: [userId]
                }, { quoted: m });
            }
        }
    },

    {
        name:        "clearwarn",
        aliases:     ["unwarn", "resetwarn"],
        description: "Clear all warnings for a student",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        async execute(sock, m, args, reply) {
            const from     = m.key.remoteJid;
            const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");
            if (!mentions.length) return reply("Usage: .clearwarn @user");

            for (const uid of mentions) {
                ldb.resetWarnings(from, uid);
            }
            await sock.sendMessage(from, {
                text: `✅ Warnings cleared for ${mentions.map(u => `@${u.split("@")[0]}`).join(", ")}` + config.footer,
                mentions
            }, { quoted: m });
        }
    },

    {
        name:        "classmute",
        aliases:     ["learnmute", "studymute"],
        description: "Mute a student for a duration",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        usage:       ".classmute @user 10m|30m|1h|3h|24h <reason>",
        async execute(sock, m, args, reply) {
            const from    = m.key.remoteJid;
            const sender  = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const durationArg = args.find(a => MUTE_DURATIONS[a]) || "10m";
            const duration    = MUTE_DURATIONS[durationArg];
            const reason      = args.filter(a => !a.includes("@") && !MUTE_DURATIONS[a]).join(" ") || "Rule violation";

            if (!mentions.length) return reply("Usage: .classmute @user 10m|1h|24h <reason>");

            for (const userId of mentions) {
                ldb.registerStudent(from, userId, userId.split("@")[0]);
                const until = ldb.muteStudent(from, userId, duration, reason, sender);
                const name  = userId.split("@")[0];

                try {
                    await sock.groupParticipantsUpdate(from, [userId], "demote").catch(() => {});
                } catch (_) {}

                await sock.sendMessage(from, {
                    text:
                        `┌ ❏ ◆ ⌜🔇 𝗦𝗧𝗨𝗗𝗘𝗡𝗧 𝗠𝗨𝗧𝗘𝗗⌟ ◆\n│\n` +
                        `├◆ 👤 @${name}\n` +
                        `├◆ ⏱️ Duration: ${durationArg}\n` +
                        `├◆ 📝 Reason: ${reason}\n` +
                        `├◆ 🔓 Unmuted: ${new Date(until).toLocaleTimeString()}\n└ ❏` + config.footer,
                    mentions: [userId]
                }, { quoted: m });
            }
        }
    },

    {
        name:        "classunmute",
        aliases:     ["learnunmute", "unmutestudent"],
        description: "Unmute a student",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        async execute(sock, m, args, reply) {
            const from     = m.key.remoteJid;
            const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");
            if (!mentions.length) return reply("Usage: .classunmute @user");

            for (const uid of mentions) {
                if (ldb.getStudent(from, uid)) {
                    ldb.getStudent(from, uid).mutedUntil = null;
                    ldb.ldb.saveLDB?.();
                }
            }
            await sock.sendMessage(from, {
                text: `🔊 Unmuted: ${mentions.map(u => `@${u.split("@")[0]}`).join(", ")}` + config.footer,
                mentions
            }, { quoted: m });
        }
    },

    {
        name:        "punishlog",
        aliases:     ["disciplinelog", "warnlog"],
        description: "View recent discipline actions",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const log = ldb.getPunishmentLog(from, 10);
            if (!log.length) return reply("No discipline actions yet. 🎉");

            const rows = log.map(l => {
                const time = new Date(l.at).toLocaleDateString();
                return `├◆ [${time}] ${l.action} — @${l.userId.split("@")[0]}\n├◆   Reason: ${l.reason}`;
            }).join("\n│\n");

            await reply(`┌ ❏ ◆ ⌜📋 𝗗𝗜𝗦𝗖𝗜𝗣𝗟𝗜𝗡𝗘 𝗟𝗢𝗚⌟ ◆\n│\n${rows}\n└ ❏`);
        }
    },

    {
        name:        "aimode",
        aliases:     ["setaimode", "agentmode"],
        description: "Control AI agent behaviour: auto | suggest | off",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const mode = args[0]?.toLowerCase();
            if (!["auto", "suggest", "off"].includes(mode)) {
                return reply(
                    `Usage: .aimode <mode>\n\n` +
                    `• *auto* — AI acts automatically (warns/mutes)\n` +
                    `• *suggest* — AI notifies admin but doesn't act\n` +
                    `• *off* — AI monitoring disabled`
                );
            }
            ldb.updateGroupSetting(from, "aiMode", mode);
            const emoji = { auto: "🤖", suggest: "💬", off: "🔴" };
            await reply(`${emoji[mode]} AI Agent mode set to *${mode}*`);
        }
    },
];
