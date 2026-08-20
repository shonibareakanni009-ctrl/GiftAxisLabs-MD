const config = require("../../config");
const os = require("os");
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "menu",
    alias: ["m"],
    async execute(sock, m, args, reply) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const secs = Math.floor(uptime % 60);

        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(1);
        const memPercent = (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(1);

        const cmdDir = path.join(__dirname, "..");
        let totalCmds = 0;
        try {
            const cats = fs.readdirSync(cmdDir).filter(f => fs.statSync(path.join(cmdDir, f)).isDirectory());
            cats.forEach(cat => {
                totalCmds += fs.readdirSync(path.join(cmdDir, cat)).filter(f => f.endsWith(".js")).length;
            });
        } catch(e) {}

        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

        const pushName = m.pushName || "User";
        const sender = m.key.participant || m.key.remoteJid;

        const p = config.prefix;

        const text = `┏━━◆ *${config.botName} - 𝐌𝐀𝐈𝐍 𝐌𝐄𝐍𝐔* ◆━━┓
┃ ⧎ ʜᴇʟʟᴏ  ${pushName}
┃ ⧎ ʙᴏᴛ ɴᴀᴍᴇ 「 *${config.botName}* 」
┃ ⧎ sᴛᴀᴛᴜs : 🟢 Active ☀️
┃ ⧎ ʀᴜɴᴛɪᴍᴇ : ${hours}h ${mins}m ${secs}s
┃ ⧎ ᴘʀᴇғɪx : 「 ${p} 」
┃ ⧎ ᴘʟᴀᴛғᴏʀᴍ : ${os.platform()}
┃ ⧎ ʀᴀᴍ : ${usedMem}GB / ${totalMem}GB (${memPercent}%)
┃ ⧎ ᴄᴏᴍᴍᴀɴᴅs : ${totalCmds} total
┃ *${greeting}*, @${sender.split("@")[0]}
┃ \`${config.botName} ᴀᴛ ʏᴏᴜʀ sᴇʀᴠɪᴄᴇ\`
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

❖═━═══𖠁𐂃𖠁══━═❖
♱  ${greeting}, *${pushName}*
*${config.botName}* ᴀᴛ ʏᴏᴜʀ sᴇʀᴠɪᴄᴇ
❖═━═══𖠁𐂃𖠁══━═❖

┏━━◆ *${config.botName} - 𝐀𝐈* ◆━━┓
│❖ ${p}ai
│❖ ${p}ask
│❖ ${p}bot
│❖ ${p}code
│❖ ${p}explain
│❖ ${p}gemini
│❖ ${p}gpt
│❖ ${p}math
│❖ ${p}solve
│❖ ${p}summary
│❖ ${p}translate
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━◆ *${config.botName} - 𝐀𝐃𝐌𝐈𝐍* ◆━━┓
│❖ ${p}add
│❖ ${p}demote
│❖ ${p}hidetag
│❖ ${p}kick
│❖ ${p}link
│❖ ${p}mute
│❖ ${p}promote
│❖ ${p}revoke
│❖ ${p}setdesc
│❖ ${p}setname
│❖ ${p}tagall
│❖ ${p}unmute
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━◆ *${config.botName} - 𝐌𝐄𝐃𝐈𝐀* ◆━━┓
│❖ ${p}fb
│❖ ${p}insta
│❖ ${p}lyrics
│❖ ${p}pinterest
│❖ ${p}play
│❖ ${p}song
│❖ ${p}sticker
│❖ ${p}tiktok
│❖ ${p}video
│❖ ${p}twitter
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━◆ *${config.botName} - 𝐅𝐔𝐍* ◆━━┓
│❖ ${p}menu
│❖ ${p}help
│❖ ${p}joke
│❖ ${p}ping
│❖ ${p}status
│❖ ${p}version
│❖ ${p}owner
│❖ ${p}script
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━◆ *${config.botName} - 𝐓𝐎𝐎𝐋𝐒* ◆━━┓
│❖ ${p}weather
│❖ ${p}calc
│❖ ${p}define
│❖ ${p}translate
│❖ ${p}qr
│❖ ${p}barcode
│❖ ${p}shorten
│❖ ${p}base64
│❖ ${p}password
│❖ ${p}github
│❖ ${p}npm
│❖ ${p}news
│❖ ${p}profile
│❖ ${p}style
│❖ ${p}fancy
│❖ ${p}contact
│❖ ${p}delete
│❖ ${p}react
│❖ ${p}quoted
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━◆ *${config.botName} - 𝐆𝐀𝐌𝐄𝐒* ◆━━┓
│❖ ${p}8ball
│❖ ${p}flip
│❖ ${p}roll
│❖ ${p}truth
│❖ ${p}dare
│❖ ${p}ship
│❖ ${p}fact
│❖ ${p}meme
│❖ ${p}quote
│❖ ${p}adventure
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━◆ *${config.botName} - 𝐄𝐂𝐎𝐍𝐎𝐌𝐘* ◆━━┓
│❖ ${p}daily
│❖ ${p}balance
│❖ ${p}bank
│❖ ${p}work
│❖ ${p}gamble
│❖ ${p}rob
│❖ ${p}transfer
│❖ ${p}leaderboard
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${config.ownerName} © ${new Date().getFullYear()}`;

        await sock.sendMessage(m.key.remoteJid, {
            text: text,
            mentions: [sender]
        }, { quoted: m });
    }
};
