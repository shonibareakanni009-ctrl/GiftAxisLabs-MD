const config = require("../../config");
const database = require("../../lib/database");
module.exports = [
  {
    name: "setrules", alias: ["addrules"],
    description: "Set group rules", category: "group", adminOnly: true, groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid;
        const rules = args.join(" ");
        if (!rules) return reply("Usage: .setrules <rule1> | <rule2> | ...\nExample: .setrules No spamming | Respect everyone | English only");
        const ruleList = rules.split("|").map(r => r.trim()).filter(Boolean);
        database.setGroupSetting(from, "rules", ruleList);
        reply(`✅ ${ruleList.length} rules saved! Members can view with .rules` + config.footer);
    }
  },
  {
    name: "rules", alias: ["grouprules","viewrules"],
    description: "View group rules", category: "group", groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid; const gs = database.getGroupSettings(from);
        if (!gs.rules?.length) return reply("No rules set yet. Admins: use .setrules to add rules.");
        const rows = gs.rules.map((r,i) => `├◆ ${i+1}. ${r}`).join("\n");
        reply(`┌ ❏ ◆ ⌜📜 𝗚𝗥𝗢𝗨𝗣 𝗥𝗨𝗟𝗘𝗦⌟ ◆\n│\n${rows}\n│\n├◆ ⚠️ Breaking rules = warning\n└ ❏` + config.footer);
    }
  }
];
