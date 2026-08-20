const config = require("../../config");
const database = require("../../lib/database");
const confessionIds = new Map();
module.exports = [
  {
    name: "setconfession", alias: ["confesschan"],
    description: "Set this group as a confession channel", category: "group",
    adminOnly: true, groupOnly: true,
    async execute(sock, m, args, reply) {
      database.setGroupSetting(m.key.remoteJid, "confessionEnabled", true);
      reply("✅ Confession mode enabled!\n\nMembers can DM me: .confess <message>\nI'll post it here anonymously 🎭" + config.footer);
    }
  },
  {
    name: "confess", alias: ["anonymous","anon"],
    description: "Send an anonymous confession to the confession group",
    category: "group",
    async execute(sock, m, args, reply) {
      const msg = args.join(" ");
      if (!msg) return reply("Usage: .confess <your anonymous message>\n\nThis will be posted anonymously in the confession group!");
      if (msg.length < 10) return reply("❌ Message too short. Be more expressive!");
      const gs = database.db.groupSettings || {};
      const groups = Object.entries(gs).filter(([,s])=>s.confessionEnabled).map(([g])=>g);
      if (!groups.length) return reply("❌ No confession group found. Ask your group admin to use .setconfession");
      const confId = "CONF-" + Math.random().toString(36).slice(2,7).toUpperCase();
      const from = m.key.remoteJid;
      const sender = m.key.participant||from;
      confessionIds.set(confId, sender);
      for(const group of groups) {
        await sock.sendMessage(group, {
          text: "┌ ❏ ◆ ⌜🎭 𝗔𝗡𝗢𝗡𝗬𝗠𝗢𝗨𝗦 𝗖𝗢𝗡𝗙𝗘𝗦𝗦𝗜𝗢𝗡⌟ ◆\n│\n" +
            "├◆ 🆔 " + confId + "\n│\n" +
            "├◆ 💬 " + msg + "\n│\n" +
            "├◆ _Anonymous confession — identity hidden_\n└ ❏" + config.footer
        });
      }
      reply("✅ Confession posted anonymously!\n🆔 Ref: " + confId + "\n\n_Your identity is hidden._" + config.footer);
    }
  }
];
