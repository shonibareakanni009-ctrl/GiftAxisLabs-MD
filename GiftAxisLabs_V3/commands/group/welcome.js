const config = require("../../config");
const database = require("../../lib/database");
module.exports = [
  {
    name: "setwelcome", alias: ["welcomemsg"],
    description: "Set a welcome message for new members", category: "group", adminOnly: true, groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid;
        const msg = args.join(" ");
        if (!msg) return reply("Usage: .setwelcome <message>\nVariables: {name} {group} {count}\nExample: .setwelcome Welcome {name} to {group}! 🎉");
        database.setGroupSetting(from, "welcomeMsg", msg);
        database.setGroupSetting(from, "welcomeEnabled", true);
        reply(`✅ Welcome message set!\n\nPreview: ${msg.replace("{name}", "NewMember").replace("{group}", "GroupName").replace("{count}", "50")}` + config.footer);
    }
  },
  {
    name: "setgoodbye", alias: ["byemsg"],
    description: "Set goodbye message", category: "group", adminOnly: true, groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid;
        const msg = args.join(" ");
        if (!msg) return reply("Usage: .setgoodbye <message>\nVariables: {name} {group}");
        database.setGroupSetting(from, "goodbyeMsg", msg);
        database.setGroupSetting(from, "goodbyeEnabled", true);
        reply(`✅ Goodbye message set!` + config.footer);
    }
  },
  {
    name: "welcome", alias: ["togglewelcome"],
    description: "Toggle welcome messages on/off", category: "group", adminOnly: true, groupOnly: true,
    async execute(sock, m, args, reply) {
        const from = m.key.remoteJid; const gs = database.getGroupSettings(from);
        const newState = !gs.welcomeEnabled;
        database.setGroupSetting(from, "welcomeEnabled", newState);
        reply(`${newState ? "✅ Welcome messages enabled" : "❌ Welcome messages disabled"}` + config.footer);
    }
  }
];
