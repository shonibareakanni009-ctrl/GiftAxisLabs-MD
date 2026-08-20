

const ldb    = require("../../lib/learningDB");
const config = require("../../config");

module.exports = [

    {
        name:        "setclass",
        aliases:     ["registerclass", "newclass"],
        description: "Register this group as a Learning Group",
        category:    "learning",
        adminOnly:   true,
        groupOnly:   true,
        usage:       ".setclass <topic> | <language>  e.g: .setclass JavaScript Basics | JavaScript",
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;

            if (ldb.isLearningGroup(from)) {
                const g = ldb.getLearningGroup(from);
                return reply(
                    `┌ ❏ ◆ ⌜📚 𝗟𝗘𝗔𝗥𝗡𝗜𝗡𝗚 𝗚𝗥𝗢𝗨𝗣 𝗔𝗖𝗧𝗜𝗩𝗘⌟ ◆\n│\n` +
                    `├◆ 📖 Topic: ${g.topic}\n` +
                    `├◆ 💻 Language: ${g.language}\n` +
                    `├◆ 🤖 AI Mode: ${g.aiMode}\n` +
                    `├◆ ⚡ Sensitivity: ${g.sensitivity}\n│\n` +
                    `├◆ Use .classconfig to change settings\n└ ❏`
                );
            }

            const raw      = args.join(" ");
            const parts    = raw.split("|").map(s => s.trim());
            const topic    = parts[0] || "General Programming";
            const language = parts[1] || "JavaScript";

            let groupName = "Learning Group";
            try {
                const meta = await sock.groupMetadata(from);
                groupName  = meta.subject || groupName;
            } catch (_) {}

            ldb.registerLearningGroup(from, groupName, sender, { topic, language });

            const senderName = m.pushName || sender.split("@")[0];
            ldb.registerStudent(from, sender, senderName, "teacher");

            await reply(
                `┌ ❏ ◆ ⌜🎓 𝗟𝗘𝗔𝗥𝗡𝗜𝗡𝗚 𝗚𝗥𝗢𝗨𝗣 𝗦𝗘𝗧 𝗨𝗣⌟ ◆\n│\n` +
                `├◆ ✅ "${groupName}" is now a Learning Group!\n│\n` +
                `├◆ 📖 Topic: ${topic}\n` +
                `├◆ 💻 Language: ${language}\n` +
                `├◆ 🤖 AI Mode: auto (Gemini monitoring active)\n` +
                `├◆ ⚡ Sensitivity: moderate\n│\n` +
                `├◆ 📋 Next steps:\n` +
                `├◆  • .setrole @user teacher — assign teacher\n` +
                `├◆  • .classconfig — change settings\n` +
                `├◆  • .startclass — open first attendance\n` +
                `├◆  • .lab <topic> — generate first coding lab\n│\n` +
                `└ ❏`
            );
        }
    },

    {
        name:        "classconfig",
        aliases:     ["classset", "classsettings"],
        description: "Configure learning group settings",
        category:    "learning",
        adminOnly:   true,
        groupOnly:   true,
        usage:       ".classconfig <setting> <value>  e.g: .classconfig sensitivity strict",
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ This group is not a Learning Group. Use .setclass first.");

            const [setting, ...valParts] = args;
            const value = valParts.join(" ");
            const g     = ldb.getLearningGroup(from);

            if (!setting) {
                return reply(
                    `┌ ❏ ◆ ⌜⚙️ 𝗖𝗟𝗔𝗦𝗦 𝗖𝗢𝗡𝗙𝗜𝗚⌟ ◆\n│\n` +
                    `├◆ Current settings:\n│\n` +
                    `├◆ 📖 topic: ${g.topic}\n` +
                    `├◆ 💻 language: ${g.language}\n` +
                    `├◆ 🤖 aimode: ${g.aiMode}\n` +
                    `├◆ ⚡ sensitivity: ${g.sensitivity}\n│\n` +
                    `├◆ Change with:\n` +
                    `├◆ .classconfig topic <new topic>\n` +
                    `├◆ .classconfig language <language>\n` +
                    `├◆ .classconfig aimode auto|suggest|off\n` +
                    `├◆ .classconfig sensitivity strict|moderate|lenient\n└ ❏`
                );
            }

            const validSettings = {
                topic:       (v) => v,
                language:    (v) => v,
                aimode:      (v) => ["auto", "suggest", "off"].includes(v) ? v : null,
                sensitivity: (v) => ["strict", "moderate", "lenient"].includes(v) ? v : null,
            };

            const key = setting.toLowerCase();
            if (!validSettings[key]) return reply(`❌ Unknown setting: ${key}\nValid: topic, language, aimode, sensitivity`);

            const validated = validSettings[key](value);
            if (!validated) return reply(`❌ Invalid value for ${key}: ${value}`);

            ldb.updateGroupSetting(from, key === "aimode" ? "aiMode" : key, validated);
            await reply(`✅ Updated *${key}* → *${validated}*`);
        }
    },

    {
        name:        "classinfo",
        aliases:     ["groupinfo", "learninginfo"],
        description: "View learning group info and stats",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const g     = ldb.getLearningGroup(from);
            const stats = ldb.getGroupStats(from);
            const top   = ldb.getLeaderboard(from, 3);
            const topStr = top.map((s, i) => `├◆ ${["🥇","🥈","🥉"][i]} ${s.name} — ${s.xp} XP`).join("\n") || "├◆ No data yet";

            await reply(
                `┌ ❏ ◆ ⌜📚 𝗖𝗟𝗔𝗦𝗦 𝗜𝗡𝗙𝗢⌟ ◆\n│\n` +
                `├◆ 🏫 ${g.name}\n` +
                `├◆ 📖 Topic: ${g.topic}\n` +
                `├◆ 💻 Language: ${g.language}\n` +
                `├◆ 🤖 AI: ${g.aiMode} | ⚡ ${g.sensitivity}\n│\n` +
                `├◆ 👥 Students: ${stats.totalStudents}\n` +
                `├◆ 📊 Avg Attendance: ${stats.avgAttendance}/class\n` +
                `├◆ 📝 Assignments: ${stats.assignmentsPosted} posted\n` +
                `├◆ 🧪 Quizzes: ${stats.quizzesDone} done\n` +
                `├◆ 👻 Ghost members: ${stats.ghostMembers}\n│\n` +
                `├◆ 🏆 Top Students:\n${topStr}\n└ ❏`
            );
        }
    },

    {
        name:        "setrole",
        aliases:     ["assignrole"],
        description: "Assign a role to a student",
        category:    "learning",
        adminOnly:   true,
        groupOnly:   true,
        usage:       ".setrole @user <role>  roles: teacher | prefect | student | guest",
        async execute(sock, m, args, reply) {
            const from    = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const role     = args.find(a => ["teacher","prefect","student","guest"].includes(a.toLowerCase()));

            if (!mentions.length || !role) {
                return reply("Usage: .setrole @user teacher|prefect|student|guest");
            }

            for (const userId of mentions) {
                ldb.registerStudent(from, userId, userId.split("@")[0], role.toLowerCase());
                ldb.setRole(from, userId, role.toLowerCase());
            }

            await sock.sendMessage(from, {
                text: `✅ Role *${role}* assigned to ${mentions.map(u => `@${u.split("@")[0]}`).join(", ")}${config.footer}`,
                mentions
            }, { quoted: m });
        }
    },

    {
        name:        "leaderboard",
        aliases:     ["lb", "topstudents", "ranks"],
        description: "Show class XP leaderboard",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const top = ldb.getLeaderboard(from, 10);
            if (!top.length) return reply("No students registered yet.");

            const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
            const rows   = top.map((s, i) =>
                `├◆ ${medals[i] || `${i+1}.`} ${s.name} — *${s.xp} XP* [${s.role}]`
            ).join("\n");

            await reply(`┌ ❏ ◆ ⌜🏆 𝗖𝗟𝗔𝗦𝗦 𝗟𝗘𝗔𝗗𝗘𝗥𝗕𝗢𝗔𝗥𝗗⌟ ◆\n│\n${rows}\n└ ❏`);
        }
    },
];
