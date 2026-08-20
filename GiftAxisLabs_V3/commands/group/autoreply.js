const config = require("../../config");
const database = require("../../lib/database");
module.exports = [
  {
    name: "autoreply", alias: ["ar","autorespond"],
    description: "Add a keyword auto-reply", category: "group", adminOnly: true, groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid;
        const raw = args.join(" ");
        const [keyword, ...responseParts] = raw.split("=>");
        if (!keyword || !responseParts.length) return reply("Usage: .autoreply <keyword> => <response>\nExample: .autoreply good morning => Good morning! Hope you have a great day! ☀️\n\nSee all: .autoreplylist\nDelete: .delauto <keyword>");
        const gs = database.getGroupSettings(from);
        if (!gs.autoReplies) gs.autoReplies = {};
        gs.autoReplies[keyword.trim().toLowerCase()] = responseParts.join("=>").trim();
        database.setGroupSetting(from, "autoReplies", gs.autoReplies);
        reply(`✅ Auto-reply saved!\nKeyword: *${keyword.trim()}*\nResponse: ${responseParts.join("=>").trim()}` + config.footer);
    }
  },
  {
    name: "autoreplylist", alias: ["arlist"],
    description: "List all auto-replies", category: "group", groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid; const gs = database.getGroupSettings(from);
        const ar = gs.autoReplies || {};
        if (!Object.keys(ar).length) return reply("No auto-replies set. Use .autoreply to add one.");
        const rows = Object.entries(ar).map(([k,v]) => `├◆ "${k}" → ${v.slice(0,40)}...`).join("\n");
        reply(`┌ ❏ ◆ ⌜🤖 𝗔𝗨𝗧𝗢-𝗥𝗘𝗣𝗟𝗜𝗘𝗦⌟ ◆\n│\n${rows}\n└ ❏` + config.footer);
    }
  },
  {
    name: "delauto", alias: ["removeauto"],
    description: "Delete an auto-reply", category: "group", adminOnly: true, groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid; const keyword = args.join(" ").toLowerCase();
        const gs = database.getGroupSettings(from);
        if (!gs.autoReplies?.[keyword]) return reply(`❌ No auto-reply for "${keyword}"`);
        delete gs.autoReplies[keyword];
        database.setGroupSetting(from, "autoReplies", gs.autoReplies);
        reply(`✅ Auto-reply for "${keyword}" deleted.` + config.footer);
    }
  }
];
