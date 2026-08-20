

const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");

const genAI = new GoogleGenerativeAI(config.geminiKey);

async function ask(prompt, jsonMode = false) {
    try {
        const model = genAI.getGenerativeModel({ model: config.geminiModel || "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (!jsonMode) return text;
        const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        return JSON.parse(clean);
    } catch (e) {
        if (jsonMode) throw e;
        return `❌ Gemini error: ${e.message}`;
    }
}


async function analyzeMessage(groupTopic, groupLanguage, sensitivity, userName, message, recentContext = []) {
    const contextStr = recentContext.slice(-5).map(m => `${m.user}: ${m.text}`).join("\n") || "none";
    const prompt = `
You are an AI monitor for a WhatsApp programming learning group.
Group topic: "${groupTopic}" | Language focus: "${groupLanguage}"
Moderation sensitivity: ${sensitivity} (strict=zero tolerance, moderate=balanced, lenient=relaxed)

Recent chat context:
${contextStr}

New message from "${userName}":
"${message}"

Analyze and respond ONLY with valid JSON (no markdown):
{
  "verdict": "ok" | "warn" | "mute_10" | "mute_60" | "kick",
  "reason": "short explanation",
  "isOffTopic": true | false,
  "confidence": 0.0 to 1.0,
  "suggestion": "what you recommend the admin do"
}

Verdict guide:
- "ok" = normal message, no action needed
- "warn" = mild violation (slightly off-topic, minor rudeness, small spam)
- "mute_10" = moderate violation (repeated off-topic, insults, sharing forbidden links)
- "mute_60" = serious violation (abusive language, cheating on quiz, harassment)
- "kick" = extreme violation (hate speech, sharing malware, doxxing)

For a PROGRAMMING group, discussing code, errors, tutorials, algorithms, tools is always ON-TOPIC.
Only flag off-topic if completely unrelated (gossip, politics, random chatter unrelated to learning).
Be lenient with greetings, encouragement, and brief social messages.
`;
    try {
        return await ask(prompt, true);
    } catch {
        return { verdict: "ok", reason: "AI parse error — defaulting to OK", isOffTopic: false, confidence: 0 };
    }
}


async function generateLab(topic, difficulty = "beginner", language = "JavaScript") {
    const prompt = `
You are an expert programming instructor creating an interactive coding lab for WhatsApp.
Style: FreeCodeCamp — structured, beginner-friendly, step-by-step.

Create a lab on: "${topic}" | Difficulty: ${difficulty} | Language: ${language}

Respond ONLY with valid JSON:
{
  "title": "Lab title",
  "language": "${language}",
  "difficulty": "${difficulty}",
  "topic": "${topic}",
  "objective": "What the student will learn",
  "concept": "Clear explanation of the concept (3-5 sentences, WhatsApp-friendly)",
  "example": {
    "code": "Working example code (well commented)",
    "explanation": "Line-by-line explanation"
  },
  "challenge": {
    "instruction": "Clear task instruction",
    "starterCode": "Starter code with blanks or TODOs",
    "hints": ["hint 1", "hint 2"],
    "testCases": [
      { "input": "input value or description", "expected": "expected output", "description": "what this tests" }
    ]
  },
  "solution": "Complete working solution code",
  "bonusChallenge": "An optional harder extension task",
  "xpReward": 20
}

Keep code examples short (max 15 lines). Make challenges achievable in 5-10 minutes.
For WhatsApp delivery, keep concept and explanations concise but complete.
`;
    return await ask(prompt, true);
}


async function evaluateCode(lab, userCode) {
    const prompt = `
You are a code evaluator for a WhatsApp programming learning group.

Lab: "${lab.title}" | Language: ${lab.language}
Challenge: ${lab.challenge.instruction}

Expected test cases:
${lab.challenge.testCases.map((t, i) => `${i + 1}. Input: ${t.input} | Expected: ${t.expected}`).join("\n")}

Student's submitted code:
\`\`\`${lab.language.toLowerCase()}
${userCode}
\`\`\`

Evaluate the code and respond ONLY with valid JSON:
{
  "passed": true | false,
  "score": 0 to 100,
  "testsPassed": 0,
  "testsTotal": ${lab.challenge.testCases.length},
  "feedback": "Encouraging, specific feedback (2-3 sentences)",
  "corrections": "Specific correction tips if code is wrong (null if passed)",
  "codeQuality": "Brief note on code style/quality",
  "xpEarned": 0 to ${lab.xpReward || 20}
}

Be encouraging even for wrong answers. Award partial credit for correct logic with syntax errors.
`;
    try {
        return await ask(prompt, true);
    } catch {
        return { passed: false, score: 0, testsPassed: 0, testsTotal: lab.challenge.testCases.length,
                 feedback: "Could not evaluate — please check your code syntax.", corrections: null,
                 codeQuality: "N/A", xpEarned: 0 };
    }
}


async function generateQuiz(topic, language = "JavaScript", numQuestions = 5, difficulty = "mixed") {
    const prompt = `
Create a multiple-choice programming quiz for a WhatsApp group.
Topic: "${topic}" | Language: ${language} | Questions: ${numQuestions} | Difficulty: ${difficulty}

Respond ONLY with valid JSON:
{
  "title": "Quiz title",
  "topic": "${topic}",
  "questions": [
    {
      "q": "Question text",
      "options": { "A": "option", "B": "option", "C": "option", "D": "option" },
      "answer": "A",
      "explanation": "Why this answer is correct",
      "points": 10,
      "difficulty": "easy | medium | hard"
    }
  ],
  "timePerQuestion": 30,
  "totalPoints": ${numQuestions * 10}
}

Make questions practical and code-focused. Include code snippets where useful.
Vary difficulty across questions if mixed.
`;
    return await ask(prompt, true);
}

async function gradeTextAssignment(assignmentTitle, description, submission) {
    const prompt = `
You are grading a programming assignment for a WhatsApp learning group.

Assignment: "${assignmentTitle}"
Description: ${description}

Student submission:
"${submission}"

Respond ONLY with valid JSON:
{
  "grade": 0 to 100,
  "grade_letter": "A | B | C | D | F",
  "summary": "2-sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "feedback": "Detailed constructive feedback (4-6 sentences)",
  "passed": true | false
}
`;
    try {
        return await ask(prompt, true);
    } catch {
        return { grade: 0, grade_letter: "F", summary: "Could not auto-grade.",
                 strengths: [], improvements: [], feedback: "Please resubmit.", passed: false };
    }
}

async function generateWeeklyReport(groupName, topic, stats) {
    const prompt = `
You are writing a weekly class report for a WhatsApp programming learning group.

Group: "${groupName}" | Topic: "${topic}"
Stats this week:
- Total students: ${stats.totalStudents}
- Average attendance: ${stats.avgAttendance} students per class
- Assignments posted: ${stats.assignmentsPosted}, completed: ${stats.assignmentsCompleted}
- Quizzes held: ${stats.quizzesDone}
- Disciplinary actions: ${stats.punishments}
- Ghost members (inactive): ${stats.ghostMembers}
- Top students: ${stats.topStudents.map(s => `${s.name} (${s.xp} XP)`).join(", ") || "N/A"}

Write a professional but warm weekly report in 3 short paragraphs:
1. Overall class performance summary
2. Key achievements and areas needing improvement
3. Recommendations for next week

Keep it WhatsApp-friendly (no markdown headers, use plain text, max 250 words).
`;
    return await ask(prompt, false);
}

async function generateCurriculum(topic, language, weeks = 4) {
    const prompt = `
Create a ${weeks}-week programming curriculum for a WhatsApp learning group.
Topic: "${topic}" | Language: ${language}

Respond ONLY with valid JSON:
{
  "title": "Curriculum title",
  "description": "2-sentence description",
  "weeks": [
    {
      "week": 1,
      "theme": "Week theme",
      "topics": ["topic 1", "topic 2", "topic 3"],
      "labSuggestions": ["Lab title 1", "Lab title 2"],
      "assignment": "Weekly assignment description",
      "goal": "What students should know by end of week"
    }
  ]
}
`;
    try {
        return await ask(prompt, true);
    } catch {
        return null;
    }
}

async function answerQuestion(question, language, context = "") {
    const prompt = `
You are a programming tutor in a WhatsApp group.
Language context: ${language}
${context ? `Recent context: ${context}` : ""}

Student question: "${question}"

Give a clear, helpful answer in WhatsApp-friendly format:
- Keep it under 200 words
- Include a short code example if relevant
- Use simple language
- End with an encouraging note
`;
    return await ask(prompt, false);
}

module.exports = {
    analyzeMessage,
    generateLab,
    evaluateCode,
    generateQuiz,
    gradeTextAssignment,
    generateWeeklyReport,
    generateCurriculum,
    answerQuestion,
};
