

const gemini = require("../../lib/geminiAgent");
const ldb    = require("../../lib/learningDB");
const config = require("../../config");

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

module.exports = [

    {
        name:        "schedule",
        aliases:     ["addschedule", "addclass"],
        description: "Add a class to the timetable",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        usage:       ".schedule <day> <time> | <title>  e.g: .schedule Monday 3pm | JavaScript Basics",
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const raw   = args.join(" ");
            const pipe  = raw.indexOf("|");
            if (pipe === -1) return reply(`Usage: .schedule <day> <time> | <title>\nExample: .schedule Monday 3pm | JavaScript Arrays`);

            const left  = raw.slice(0, pipe).trim().split(" ");
            const title = raw.slice(pipe + 1).trim();
            const day   = left[0];
            const time  = left.slice(1).join(" ");

            if (!day || !time || !title) return reply("❌ Please provide day, time, and title.");

            const entry = ldb.addSchedule(from, { day, time, title });

            const todayName = DAYS[new Date().getDay()];
            if (day.toLowerCase() === todayName.toLowerCase()) {
                try {
                    const [hourMin, ampm] = time.match(/(\d+(?::\d+)?)(am|pm)?/i)?.slice(1) || [];
                    if (hourMin) {
                        let [h, min = 0] = hourMin.split(":").map(Number);
                        if (ampm?.toLowerCase() === "pm" && h < 12) h += 12;
                        if (ampm?.toLowerCase() === "am" && h === 12) h = 0;
                        const now     = new Date();
                        const target  = new Date(now); target.setHours(h, Number(min) - 15, 0, 0);
                        const diff    = target.getTime() - now.getTime();
                        if (diff > 0) {
                            setTimeout(async () => {
                                await sock.sendMessage(from, {
                                    text: `⏰ *15-min reminder!*\n📚 *${title}* starts at ${time} today!` + config.footer
                                });
                            }, diff);
                        }
                    }
                } catch (_) {}
            }

            await reply(
                `┌ ❏ ◆ ⌜📅 𝗦𝗖𝗛𝗘𝗗𝗨𝗟𝗘 𝗔𝗗𝗗𝗘𝗗⌟ ◆\n│\n` +
                `├◆ 📌 ${title}\n` +
                `├◆ 📅 ${day} at ${time}\n` +
                `├◆ 🆔 ${entry.id}\n│\n` +
                `├◆ View timetable: .timetable\n└ ❏`
            );
        }
    },

    {
        name:        "timetable",
        aliases:     ["schedule", "classtable", "tt"],
        description: "View the class timetable",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const entries = ldb.getSchedule(from);
            if (!entries.length) return reply("No schedule set yet. Admin: use .schedule to add classes.");

            const byDay = {};
            for (const e of entries) {
                const d = e.day || "Unscheduled";
                if (!byDay[d]) byDay[d] = [];
                byDay[d].push(e);
            }

            const g    = ldb.getLearningGroup(from);
            let text   = `┌ ❏ ◆ ⌜📅 𝗧𝗜𝗠𝗘𝗧𝗔𝗕𝗟𝗘 — ${g.name.toUpperCase()}⌟ ◆\n│\n`;
            const today = DAYS[new Date().getDay()];

            for (const [day, classes] of Object.entries(byDay)) {
                const isToday = day.toLowerCase() === today.toLowerCase();
                text += `├◆ ${isToday ? "📍" : "📌"} *${day}*${isToday ? " (TODAY)" : ""}\n`;
                for (const c of classes) {
                    text += `├◆   🕐 ${c.time} — ${c.title}\n`;
                }
                text += `│\n`;
            }
            text += `└ ❏`;

            await reply(text);
        }
    },

    {
        name:        "removeschedule",
        aliases:     ["delschedule", "rmschedule"],
        description: "Remove a schedule entry by ID",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");
            if (!args[0]) return reply("Usage: .removeschedule <id>  (see IDs in .timetable)");

            ldb.removeSchedule(from, args[0]);
            await reply(`✅ Schedule entry removed.`);
        }
    },

    {
        name:        "report",
        aliases:     ["weeklyreport", "classreport"],
        description: "Generate an AI weekly class report",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const g     = ldb.getLearningGroup(from);
            const stats = ldb.getGroupStats(from);

            await reply("⏳ Generating weekly report with Gemini AI...");

            try {
                const reportText = await gemini.generateWeeklyReport(g.name, g.topic, stats);

                await sock.sendMessage(from, {
                    text:
                        `┌ ❏ ◆ ⌜📊 𝗪𝗘𝗘𝗞𝗟𝗬 𝗖𝗟𝗔𝗦𝗦 𝗥𝗘𝗣𝗢𝗥𝗧⌟ ◆\n│\n` +
                        `├◆ 📅 ${new Date().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}\n` +
                        `├◆ 🏫 ${g.name}\n│\n` +
                        reportText.split("\n").map(l => `├◆ ${l}`).join("\n") +
                        `\n│\n` +
                        `├◆ 📊 Stats: ${stats.totalStudents} students | ${stats.avgAttendance} avg attendance\n` +
                        `└ ❏` + config.footer
                }, { quoted: m });
            } catch (e) {
                await reply(`❌ Report error: ${e.message}`);
            }
        }
    },

    {
        name:        "studyreminder",
        aliases:     ["classremind", "sremind"],
        description: "Set a study reminder for the group",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        usage:       ".studyreminder <minutes> | <message>",
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const raw     = args.join(" ");
            const parts   = raw.split("|").map(s => s.trim());
            const minutes = parseInt(parts[0]);
            const msg     = parts[1] || "Class starts soon!";

            if (isNaN(minutes) || minutes < 1) return reply("Usage: .studyreminder <minutes> | <message>\nExample: .studyreminder 15 | Arrays class starts soon!");

            await reply(`✅ Reminder set for ${minutes} min from now.`);

            setTimeout(async () => {
                await sock.sendMessage(from, {
                    text: `⏰ *STUDY REMINDER*\n\n${msg}` + config.footer
                });
            }, minutes * 60 * 1000);
        }
    },

    {
        name:        "broadcast",
        aliases:     ["announce", "classannounce"],
        description: "Broadcast an announcement to all learning groups",
        category:    "learning",
        ownerOnly:   true,
        usage:       ".broadcast <message>",
        async execute(sock, m, args, reply) {
            const message = args.join(" ");
            if (!message) return reply("Usage: .broadcast <announcement>");

            const groups = ldb.getAllLearningGroups();
            if (!groups.length) return reply("No learning groups registered.");

            let sent = 0;
            for (const [groupId] of groups) {
                try {
                    await sock.sendMessage(groupId, {
                        text:
                            `📢 *CLASS ANNOUNCEMENT*\n\n${message}` + config.footer
                    });
                    sent++;
                } catch (_) {}
                await new Promise(r => setTimeout(r, 500)); // rate limit
            }

            await reply(`✅ Broadcast sent to ${sent}/${groups.length} learning groups.`);
        }
    },
];
