

const gemini = require("../../lib/geminiAgent");
const ldb    = require("../../lib/learningDB");
const config = require("../../config");

const deadlineTimers = new Map();

function scheduleReminders(sock, groupId, assignment) {
    const now      = Date.now();
    const deadline = assignment.deadline;
    const key      = `${groupId}_${assignment.id}`;

    const oneHour = deadline - now - 3600000;
    if (oneHour > 0) {
        const t1 = setTimeout(async () => {
            const a = ldb.getAssignmentById(groupId, assignment.id);
            if (!a) return;
            const submitted = Object.keys(a.submissions || {}).length;
            const total     = Object.keys(ldb.getAllStudents(groupId)).length;
            await sock.sendMessage(groupId, {
                text:
                    `⏰ *Assignment Reminder — 1 Hour Left!*\n\n` +
                    `📝 *${a.title}*\n` +
                    `📊 Submitted: ${submitted}/${total} students\n` +
                    `⏳ Deadline: ${new Date(a.deadline).toLocaleString()}\n\n` +
                    `Submit with *.submit_hw ${a.id} <your answer>*` + config.footer
            });
        }, oneHour);
        deadlineTimers.set(`${key}_1h`, t1);
    }

    const tenMin = deadline - now - 600000;
    if (tenMin > 0) {
        const t2 = setTimeout(async () => {
            const a           = ldb.getAssignmentById(groupId, assignment.id);
            if (!a) return;
            const allStudents = ldb.getAllStudents(groupId);
            const notSubmitted = Object.keys(allStudents)
                .filter(uid => !a.submissions?.[uid])
                .map(uid => `@${uid.split("@")[0]}`);
            if (!notSubmitted.length) return;
            await sock.sendMessage(groupId, {
                text:
                    `🚨 *10 MINUTES LEFT!* — Assignment: *${a.title}*\n\n` +
                    `Still haven't submitted:\n` +
                    notSubmitted.join(", ") + `\n\n` +
                    `Submit NOW with *.submit_hw ${a.id} <answer>*` + config.footer,
                mentions: Object.keys(allStudents).filter(uid => !a.submissions?.[uid])
            });
        }, tenMin);
        deadlineTimers.set(`${key}_10m`, t2);
    }
}

module.exports = [

    {
        name:        "assign",
        aliases:     ["setassignment", "homework", "hw"],
        description: "Create a new assignment",
        category:    "learning",
        groupOnly:   true,
        adminOnly:   true,
        usage:       '.assign <title> | <description> | <deadline>   e.g: .assign Functions Quiz | Write a function that adds two numbers | Tomorrow 5pm',
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const raw   = args.join(" ");
            const parts = raw.split("|").map(s => s.trim());
            if (parts.length < 2) {
                return reply(
                    `Usage: .assign <title> | <description> | <deadline>\n\n` +
                    `Example:\n.assign Loops Homework | Write a for-loop that prints 1-10 | Friday 5pm`
                );
            }

            const title       = parts[0];
            const description = parts[1] || "See class notes.";
            const deadlineStr = parts[2] || "End of day";

            let deadlineMs = Date.parse(deadlineStr);
            if (isNaN(deadlineMs)) {
                const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                if (deadlineStr.toLowerCase().includes("tomorrow")) deadlineMs = tomorrow.getTime();
                else if (deadlineStr.toLowerCase().includes("friday")) {
                    const d = new Date(); while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
                    deadlineMs = d.getTime();
                } else deadlineMs = Date.now() + 86400000; // default: 24 hours
            }

            const assignment = ldb.createAssignment(from, {
                title, description, deadline: deadlineMs, createdBy: sender
            });

            scheduleReminders(sock, from, assignment);

            const dateStr = new Date(deadlineMs).toLocaleString("en-US", {
                weekday: "short", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit"
            });

            await sock.sendMessage(from, {
                text:
                    `┌ ❏ ◆ ⌜📝 𝗡𝗘𝗪 𝗔𝗦𝗦𝗜𝗚𝗡𝗠𝗘𝗡𝗧⌟ ◆\n│\n` +
                    `├◆ 📌 *${title}*\n│\n` +
                    `├◆ 📋 ${description}\n│\n` +
                    `├◆ 🆔 ID: ${assignment.id}\n` +
                    `├◆ ⏰ Deadline: ${dateStr}\n│\n` +
                    `├◆ ✏️ Submit: .submit_hw ${assignment.id} <your answer>\n` +
                    `├◆ 📎 Or reply to this message with your work\n│\n` +
                    `├◆ ⚠️ Reminders: 1hr & 10min before deadline\n└ ❏` + config.footer
            }, { quoted: m });
        }
    },

    {
        name:        "submit_hw",
        aliases:     ["submithw", "submitwork", "turnin"],
        description: "Submit your assignment",
        category:    "learning",
        groupOnly:   true,
        usage:       ".submit_hw <assignment_id> <your answer/work>",
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return;

            if (args.length < 2) {
                const active = ldb.getAssignments(from, true);
                if (!active.length) return reply("No active assignments found.");
                const list = active.map(a =>
                    `├◆ *${a.id}* — ${a.title} (due ${new Date(a.deadline).toLocaleDateString()})`
                ).join("\n");
                return reply(`Current assignments:\n${list}\n\nUse: .submit_hw <id> <your answer>`);
            }

            const [assignId, ...answerParts] = args;
            const content = answerParts.join(" ").trim();
            if (!content) return reply("❌ Please include your answer/work.");

            const a = ldb.getAssignmentById(from, assignId);
            if (!a) return reply(`❌ Assignment ID "${assignId}" not found.`);

            if (Date.now() > a.deadline) {
                return reply(`⚠️ Deadline passed for *${a.title}*! Submission recorded as LATE.`);
            }

            const name    = m.pushName || sender.split("@")[0];
            ldb.registerStudent(from, sender, name);
            ldb.submitAssignment(from, assignId, sender, name, content);

            await reply(
                `┌ ❏ ◆ ⌜✅ 𝗦𝗨𝗕𝗠𝗜𝗧𝗧𝗘𝗗!⌟ ◆\n│\n` +
                `├◆ 📝 Assignment: ${a.title}\n` +
                `├◆ 👤 Student: ${name}\n` +
                `├◆ ⏰ Time: ${new Date().toLocaleTimeString()}\n│\n` +
                `├◆ 🤖 AI grading pending...\n└ ❏`
            );

            try {
                const result = await gemini.gradeTextAssignment(a.title, a.description, content);
                ldb.gradeAssignment(from, assignId, sender, result.grade, result.feedback);

                await sock.sendMessage(from, {
                    text:
                        `┌ ❏ ◆ ⌜📊 𝗔𝗜 𝗚𝗥𝗔𝗗𝗘 — ${name}⌟ ◆\n│\n` +
                        `├◆ 📝 ${a.title}\n` +
                        `├◆ 🎯 Grade: *${result.grade}/100* (${result.grade_letter})\n│\n` +
                        `├◆ 💬 ${result.summary}\n│\n` +
                        (result.strengths?.length ? `├◆ ✅ Strengths:\n${result.strengths.map(s => `├◆   • ${s}`).join("\n")}\n│\n` : "") +
                        (result.improvements?.length ? `├◆ 🔧 Improve:\n${result.improvements.map(i => `├◆   • ${i}`).join("\n")}\n│\n` : "") +
                        `└ ❏` + config.footer,
                    mentions: [sender]
                }, { quoted: m });
            } catch (_) {}
        }
    },

    {
        name:        "assignments",
        aliases:     ["homeworklist", "hwlist", "tasks"],
        description: "View all assignments and submission status",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const all = ldb.getAssignments(from);
            if (!all.length) return reply("No assignments yet. Teachers use .assign to create one.");

            const lines = all.slice(-8).reverse().map(a => {
                const due       = new Date(a.deadline);
                const isLate    = Date.now() > a.deadline;
                const submitted = Object.keys(a.submissions || {}).length;
                const mySubmit  = !!a.submissions?.[sender];
                const status    = isLate ? "🔴 Closed" : "🟢 Open";
                return (
                    `├◆ *${a.title}*\n` +
                    `├◆   ID: ${a.id} | ${status}\n` +
                    `├◆   Due: ${due.toLocaleDateString()} | Submitted: ${submitted}\n` +
                    `├◆   You: ${mySubmit ? "✅ Submitted" : "❌ Not submitted"}`
                );
            }).join("\n│\n");

            await reply(`┌ ❏ ◆ ⌜📚 𝗔𝗦𝗦𝗜𝗚𝗡𝗠𝗘𝗡𝗧𝗦⌟ ◆\n│\n${lines}\n└ ❏`);
        }
    },

    {
        name:        "grades",
        aliases:     ["mygrades", "mymarks"],
        description: "View your assignment grades",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from   = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const all    = ldb.getAssignments(from);
            const grades = all
                .filter(a => a.submissions?.[sender])
                .map(a => {
                    const sub = a.submissions[sender];
                    return `├◆ ${a.title}: *${sub.grade ?? "Pending"}* — ${sub.feedback ? sub.feedback.slice(0, 50) + "..." : ""}`;
                });

            if (!grades.length) return reply("No graded assignments yet.");
            await reply(`┌ ❏ ◆ ⌜📊 𝗠𝗬 𝗚𝗥𝗔𝗗𝗘𝗦⌟ ◆\n│\n${grades.join("\n")}\n└ ❏`);
        }
    },
];
