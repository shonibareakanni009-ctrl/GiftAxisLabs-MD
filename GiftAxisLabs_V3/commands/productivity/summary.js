const config = require("../../config");
const { GoogleGenerativeAI } = require("@google/generative-ai");
module.exports = {
    name: "summary", alias: ["summarize","tldr"],
    async execute(sock, m, args, reply) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const text = args.join(" ") || quoted?.conversation || quoted?.extendedTextMessage?.text;
        if (!text || text.length < 20) return reply("Usage: .summary <long text>\nOr: Reply to a message with .summary");
        try {
            reply("⏳ Summarizing with AI...");
            const genAI = new GoogleGenerativeAI(config.geminiKey);
            const model = genAI.getGenerativeModel({ model: config.geminiModel || "gemini-2.0-flash" });
            const result = await model.generateContent(`Summarize this in 3-5 bullet points, keep it concise and clear:\n\n${text}`);
            const summary = result.response.text().trim();
            reply(`📝 *Summary:*\n\n${summary}` + config.footer);
        } catch(e) { reply("❌ Summary failed: " + e.message); }
    }
};
