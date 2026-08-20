

module.exports = {
    botName:     "𝐆𝐈𝐅𝐓-𝐀𝐗𝐈𝐒 𝐌𝐃",
    ownerName:   "Gift",

    ownerNumber: [process.env.OWNER_NUMBER ? process.env.OWNER_NUMBER + "@s.whatsapp.net" : "YOUR_NUMBER@s.whatsapp.net"],

    prefix: ".",

    geminiKey:   process.env.GEMINI_KEY   || "YOUR_GEMINI_API_KEY",
    geminiModel: "gemini-2.0-flash",

    telegramBotToken:  process.env.TELEGRAM_BOT_TOKEN  || "YOUR_TELEGRAM_BOT_TOKEN",
    telegramBotToken2: process.env.TELEGRAM_BOT_TOKEN2 || "",
    telegramBotToken3: process.env.TELEGRAM_BOT_TOKEN3 || "",
    telegramBotToken4: process.env.TELEGRAM_BOT_TOKEN4 || "",
    telegramBotToken5: process.env.TELEGRAM_BOT_TOKEN5 || "",

    telegramOwnerId: process.env.TELEGRAM_OWNER_ID || "",

    ngrokAuthToken: process.env.NGROK_AUTH_TOKEN || "",
    ngrokEnabled:   process.env.NGROK_ENABLED !== "false",

    openPairing: true,

    adminUser:     process.env.ADMIN_USER     || "admin",
    adminPassword: process.env.ADMIN_PASSWORD || "change-this-password",

    apiSecretKey: process.env.API_SECRET_KEY || "giftaxis-secret-change-me",

    footer: "\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ Gift Axis Labs™",

    autoRead:   false,   // Auto-read all messages
    autoStatus: true,    // Auto-view status updates

    msg: {
        wait:  "┌ ❏ ◆ ⌜⏳ 𝗣𝗥𝗢𝗖𝗘𝗦𝗦𝗜𝗡𝗚⌟ ◆\n│\n├◆ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ...\n│\n└ ❏",
        admin: "┌ ❏ ◆ ⌜⚠️ 𝗔𝗗𝗠𝗜𝗡 𝗢𝗡𝗟𝗬⌟ ◆\n│\n├◆ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ʀᴇǫᴜɪʀᴇs ᴀᴅᴍɪɴ\n│\n└ ❏",
        owner: "┌ ❏ ◆ ⌜⚠️ 𝗢𝗪𝗡𝗘𝗥 𝗢𝗡𝗟𝗬⌟ ◆\n│\n├◆ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ʀᴇǫᴜɪʀᴇs ᴏᴡɴᴇʀ\n│\n└ ❏",
        group: "┌ ❏ ◆ ⌜⚠️ 𝗚𝗥𝗢𝗨𝗣 𝗢𝗡𝗟𝗬⌟ ◆\n│\n├◆ ᴜsᴇ ɪɴ ɢʀᴏᴜᴘ ᴄʜᴀᴛ ᴏɴʟʏ\n│\n└ ❏",
        error: "┌ ❏ ◆ ⌜❌ 𝗘𝗥𝗥𝗢𝗥⌟ ◆\n│\n├◆ ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ\n│\n└ ❏"
    }
};
