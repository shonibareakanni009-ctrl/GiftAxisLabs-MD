

const gemini = require("../../lib/geminiAgent");
const ldb    = require("../../lib/learningDB");
const config = require("../../config");

const quizTimers = new Map();

function clearQuizTimer(groupId) {
    if (quizTimers.has(groupId)) {
        clearTimeout(quizTimers.get(groupId));
        quizTimers.delete(groupId);
    }
}

async function sendQuestion(sock, groupId, quiz, questionIndex) {
    if (questionIndex >= quiz.questions.length) return;
    const q   = quiz.questions[questionIndex];
    const num = questionIndex + 1;

    const optStr = Object.entries(q.options)
        .map(([k, v]) => `├◆ *${k}.* ${v}`)
        .join("\n");

    await sock.sendMessage(groupId, {
        text:
            `┌ ❏ ◆ ⌜🧪 𝗤𝗨𝗘𝗦𝗧𝗜𝗢𝗡 ${num}/${quiz.questions.length}⌟ ◆\n│\n` +
            `├◆ ❓ ${q.q}\n│\n` +
            `${optStr}\n│\n` +
            `├◆ ⏱️ ${q.difficulty?.toUpperCase() || "Q"} — ${q.points} pts\n` +
            `├◆ Reply: A, B, C, or D\n└ ❏` + config.footer
    });
}

module.exports = [

    {
        name:        "quiz",
        aliases:     ["startquiz", "genquiz"],
        description: "Generate and start an AI quiz",
        category:    "learning",
        groupOnly:   true,
        usage:       ".quiz <topic> [questions] e.g: .quiz JavaScript arrays 5",
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            if (!ldb.isLearningGroup(from)) return reply("❌ Not a Learning Group.");

            const existing = ldb.getActiveQuiz(from);
            if (existing) return reply("⚠️ A quiz is already running! Use .endquiz to stop it.");

            if (!args.length) {
                return reply(
                    `Usage: .quiz <topic> [num_questions]\n` +
                    `Example: .quiz JavaScript loops 5\n` +
                    `Default: 5 questions`
                );
            }

            let numQ    = 5;
            let topicArgs = [...args];
            const lastArg = parseInt(args[args.length - 1]);
            if (!isNaN(lastArg) && lastArg >= 2 && lastArg <= 15) {
                numQ = lastArg;
                topicArgs.pop();
            }
            const topic = topicArgs.join(" ");
            const g     = ldb.getLearningGroup(from);

            await reply(`⏳ Generating ${numQ}-question quiz on *${topic}*...`);

            try {
                const quizData = await gemini.generateQuiz(topic, g.language, numQ);
                if (!quizData?.questions?.length) return reply("❌ Failed to generate quiz. Try again.");

                quizData.createdBy = m.key.participant || m.key.remoteJid;
                const quiz = ldb.startQuiz(from, quizData);

                await sock.sendMessage(from, {
                    text:
                        `┌ ❏ ◆ ⌜🧪 𝗤𝗨𝗜𝗭 𝗦𝗧𝗔𝗥𝗧𝗜𝗡𝗚!⌟ ◆\n│\n` +
                        `├◆ 📖 ${quiz.title}\n` +
                        `├◆ ❓ ${quiz.questions.length} Questions\n` +
                        `├◆ ⭐ ${quiz.totalPoints} Total Points\n` +
                        `├◆ ⏱️ ${quiz.timePerQuestion}s per question\n│\n` +
                        `├◆ Reply A, B, C, or D to answer\n└ ❏` + config.footer
                }, { quoted: m });

                setTimeout(async () => {
                    await sendQuestion(sock, from, quiz, 0);

                    const timer = setTimeout(async () => {
                        await advanceToNext(sock, from, quiz);
                    }, (quiz.timePerQuestion + 5) * 1000);
                    quizTimers.set(from, timer);

                }, 3000);

            } catch (e) {
                await reply(`❌ Quiz error: ${e.message}`);
            }
        }
    },

    async function handleQuizAnswer(sock, from, sender, senderName, text) {
        const quiz = ldb.getActiveQuiz(from);
        if (!quiz) return false;

        const answer = text.trim().toUpperCase();
        if (!["A", "B", "C", "D"].includes(answer)) return false;

        const qIndex  = quiz.currentQ;
        const q       = quiz.questions[qIndex];
        if (!q) return false;

        if (quiz.answered?.[qIndex]?.[sender] !== undefined) return true; // already answered

        const isCorrect = answer === q.answer;
        ldb.recordAnswer(from, sender, senderName, qIndex, isCorrect, q.points);

        if (isCorrect) {
            await sock.sendMessage(from, {
                text: `✅ *${senderName}* got it right! +${q.points} pts 🎉`,
                mentions: [sender]
            });
        } else {
            await sock.sendMessage(from, {
                text: `❌ *${senderName}* — wrong answer.`,
                mentions: [sender]
            });
        }
        return true;
    },

    {
        name:        "nextquestion",
        aliases:     ["nextq", "next"],
        description: "Move to next quiz question (teacher only)",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from  = m.key.remoteJid;
            const quiz  = ldb.getActiveQuiz(from);
            if (!quiz) return reply("❌ No quiz running.");

            clearQuizTimer(from);
            await advanceToNext(sock, from, quiz);
        }
    },

    {
        name:        "endquiz",
        aliases:     ["stopquiz", "finishquiz"],
        description: "End the current quiz and show results",
        category:    "learning",
        groupOnly:   true,
        async execute(sock, m, args, reply) {
            const from = m.key.remoteJid;
            clearQuizTimer(from);
            const quiz = ldb.endQuiz(from);
            if (!quiz) return reply("❌ No active quiz.");
            await sendQuizResults(sock, from, quiz);
        }
    },
];

async function advanceToNext(sock, groupId, quiz) {
    clearQuizTimer(groupId);

    const q = quiz.questions[quiz.currentQ];
    if (q) {
        await sock.sendMessage(groupId, {
            text:
                `💡 *Answer:* ${q.answer} — ${q.options[q.answer]}\n` +
                `📝 ${q.explanation}` + config.footer
        });
    }

    const nextQ = ldb.advanceQuiz(groupId);

    if (!nextQ) {
        const ended = ldb.endQuiz(groupId);
        await sendQuizResults(sock, groupId, ended);
        return;
    }

    await sendQuestion(sock, groupId, ldb.getActiveQuiz(groupId), ldb.getActiveQuiz(groupId)?.currentQ || 0);

    const timer = setTimeout(async () => {
        const current = ldb.getActiveQuiz(groupId);
        if (current) await advanceToNext(sock, groupId, current);
    }, (quiz.timePerQuestion + 5) * 1000);
    quizTimers.set(groupId, timer);
}

async function sendQuizResults(sock, groupId, quiz) {
    if (!quiz) return;
    const scores = Object.entries(quiz.scores || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    const medals  = ["🥇","🥈","🥉"];
    const rows    = scores.length
        ? scores.map(([uid, pts], i) => `├◆ ${medals[i] || `${i+1}.`} @${uid.split("@")[0]} — ${pts} pts`).join("\n")
        : "├◆ No answers recorded";
    const mentions = scores.map(([uid]) => uid);

    await sock.sendMessage(groupId, {
        text:
            `┌ ❏ ◆ ⌜🏆 𝗤𝗨𝗜𝗭 𝗥𝗘𝗦𝗨𝗟𝗧𝗦⌟ ◆\n│\n` +
            `├◆ 📖 ${quiz.title}\n│\n` +
            `${rows}\n└ ❏` + config.footer,
        mentions,
    });
}

module.exports.handleQuizAnswer = module.exports[1];
