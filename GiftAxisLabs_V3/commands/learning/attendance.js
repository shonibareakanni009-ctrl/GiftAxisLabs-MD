

const ldb    = require("../../lib/learningDB");
const config = require("../../config");

module.exports = [

    {
        name:        "startclass",
        aliases:     ["openclass", "beginclass"],
        description: "Open attendance for today's class",
        category:    "learning",
        groupOnly:   true,
        usage:       ".startclass",
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group. Use .setclass first.");

            const s = ldb.getStudent(from, sender);
            if (!s) ldb.registerStudent(from, sender, m.pushName || "Teacher", "teacher");

            const g = ldb.getLearningGroup(from);
            if (g.classOpen) return reply("⚠️ Class is already open! Use .endclass to close it first.");

            const session     = ldb.openAttendance(from, sender);
            const dateStr     = new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"short", day:"numeric" });
            const senderName  = m.pushName || sender.split("@")[0];

            await sock.sendMessage(from, {
                text:
                    `┌ ❏ ◆ ⌜📋 𝗖𝗟𝗔𝗦𝗦 𝗦𝗧𝗔𝗥𝗧𝗘𝗗⌟ ◆\n│\n` +
                    `├◆ 🏫 ${g.name}\n` +
                    `├◆ 📅 ${dateStr}\n` +
                    `├◆ 👨‍🏫 Opened by: ${senderName}\n│\n` +
                    `├◆ ✋ Type *.present* to mark attendance\n` +
                    `├◆ ⏱️ Attendance open until .endclass\n│\n` +
                    `├◆ 📖 Today's topic: ${g.topic}\n` +
                    `└ ❏` + config.footer,
            }, { quoted: m });
        }
    },

    {
        name:        "present",
        aliases:     ["here", "attendance", "signin"],
        description: "Mark yourself present in today's class",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return; // silent — not a learning group

            const g = ldb.getLearningGroup(from);
            if (!g?.classOpen) return reply("⚠️ No class is open right now. Wait for teacher to start class.");

            const name    = m.pushName || sender.split("@")[0];
            ldb.registerStudent(from, sender, name); // auto-register if not yet
            const marked  = ldb.markPresent(from, sender, name);

            if (!marked) {
                return reply(`✅ @${name} — you're already marked present!`);
            }

            const history = ldb.getAttendanceHistory(from, 1);
            const session = history[0];
            const count   = session?.present?.length || 1;

            await sock.sendMessage(from, {
                text:     `✅ *${name}* marked present! (+5 XP)\n👥 ${count} student${count > 1 ? "s" : ""} in class` + config.footer,
                mentions: [sender]
            }, { quoted: m });
        }
    },

    {
        name:        "endclass",
        aliases:     ["closeclass", "finishclass"],
        description: "Close attendance and generate report",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const g = ldb.getLearningGroup(from);
            if (!g?.classOpen) return reply("⚠️ No class is currently open.");

            let allParticipants = [];
            try {
                const meta = await sock.groupMetadata(from);
                allParticipants = meta.participants.map(p => ({
                    id:   p.id,
                    name: p.notify || p.id.split("@")[0]
                }));
            } catch (_) {}

            const session = ldb.closeAttendance(from, allParticipants);
            if (!session) return reply("❌ Could not close attendance.");

            const presentList = session.present.map(p => `✅ ${p.name}`).join("\n") || "None";
            const absentList  = session.absent.map(p => `❌ ${p.name}`).join("\n")  || "None";
            const duration    = session.closedAt
                ? Math.round((session.closedAt - new Date(session.date).getTime()) / 60000)
                : 0;

            const allStudents = ldb.getAllStudents(from);
            const warningList = [];
            for (const [uid, s] of Object.entries(allStudents)) {
                const rate = ldb.getStudentAttendanceRate(from, uid);
                const history = ldb.getAttendanceHistory(from, 3);
                const recentAbsences = history.filter(sess => sess.absent.find(a => a.userId === uid)).length;
                if (recentAbsences >= 3) {
                    const warns = ldb.addWarning(from, uid, "3 consecutive absences", "System");
                    warningList.push(`⚠️ @${uid.split("@")[0]} (${warns} warn${warns > 1 ? "s" : ""})`);
                    await sock.sendMessage(from, {
                        text: `⚠️ *Attendance Warning* — @${uid.split("@")[0]}, you've missed 3 classes in a row. This is warn #${warns}. Please reach out to your teacher!` + config.footer,
                        mentions: [uid]
                    }).catch(() => {});
                }
            }

            await reply(
                `┌ ❏ ◆ ⌜📊 𝗖𝗟𝗔𝗦𝗦 𝗘𝗡𝗗𝗘𝗗⌟ ◆\n│\n` +
                `├◆ ⏱️ Duration: ~${duration} min\n` +
                `├◆ ✅ Present (${session.present.length}):\n` +
                session.present.map(p => `├◆   • ${p.name}`).join("\n") + "\n│\n" +
                `├◆ ❌ Absent (${session.absent.length}):\n` +
                session.absent.slice(0, 10).map(p => `├◆   • ${p.name}`).join("\n") +
                (session.absent.length > 10 ? `\n├◆   ...+${session.absent.length - 10} more` : "") +
                (warningList.length ? `\n│\n├◆ ⚠️ Absence Warnings:\n${warningList.map(w => `├◆   ${w}`).join("\n")}` : "") +
                `\n└ ❏`
            );
        }
    },

    {
        name:        "attendancelog",
        aliases:     ["attlog", "classhistory"],
        description: "View attendance history",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const history = ldb.getAttendanceHistory(from, 5);
            if (!history.length) return reply("No attendance sessions yet. Use .startclass to begin.");

            const rows = history.map((s, i) => {
                const d = new Date(s.date).toLocaleDateString("en-US", { month:"short", day:"numeric" });
                return `├◆ ${i + 1}. ${d} — ✅${s.present.length} ❌${s.absent.length}`;
            }).join("\n");

            await reply(`┌ ❏ ◆ ⌜📋 𝗔𝗧𝗧𝗘𝗡𝗗𝗔𝗡𝗖𝗘 𝗛𝗜𝗦𝗧𝗢𝗥𝗬⌟ ◆\n│\n${rows}\n└ ❏`);
        }
    },

    {
        name:        "mystats",
        aliases:     ["myxp", "myprofile", "myclass"],
        description: "View your learning stats",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const s = ldb.getStudent(from, sender);
            if (!s) return reply("You're not registered yet. Type .present when class is open to join!");

            const rate    = ldb.getStudentAttendanceRate(from, sender);
            const labStat = ldb.getLabStats(sender);

            await reply(
                `┌ ❏ ◆ ⌜👤 𝗠𝗬 𝗦𝗧𝗔𝗧𝗦⌟ ◆\n│\n` +
                `├◆ 📛 Name: ${s.name}\n` +
                `├◆ 🎭 Role: ${s.role}\n` +
                `├◆ ⭐ XP: ${s.xp}\n` +
                `├◆ ⚠️ Warnings: ${s.warnings}/3\n` +
                `├◆ 📅 Attendance: ${rate}%\n` +
                `├◆ 🧪 Labs done: ${labStat.completed}\n` +
                `├◆ 🎮 Lab XP: ${labStat.xp}\n│\n` +
                `└ ❏`
            );
        }
    },
];
