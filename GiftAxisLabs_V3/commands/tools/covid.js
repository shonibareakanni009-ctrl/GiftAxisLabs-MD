
const fs = require("fs-extra");
const path = require("path");
const config = require("../../config");
const DB = path.join(__dirname, "../../data/economy.json");
async function getDB() { await fs.ensureFile(DB); return fs.readJson(DB).catch(() => ({})); }
async function saveDB(db) { await fs.writeJson(DB, db); }
function getUser(db, id) {
    if (!db[id]) db[id] = { balance: 0, bank: 0, hp: 100, maxHp: 100, inventory: [], xp: 0, lastFish: 0, lastHunt: 0, lastMine: 0 };
    if (!db[id].inventory) db[id].inventory = [];
    if (db[id].hp === undefined) db[id].hp = 100;
    if (!db[id].maxHp) db[id].maxHp = 100;
    if (!db[id].xp) db[id].xp = 0;
    return db[id];
}
const axios = require("axios");
module.exports = {
    name: "covid", alias: ["covidstats"],
    async execute(sock, m, args, reply) {
        const country = args.join(" ") || "world";
        try {
            const res = await axios.get(`https://disease.sh/v3/covid-19/${country === "world" ? "all" : "countries/" + encodeURIComponent(country)}`, { timeout: 8000 });
            const d = res.data;
            reply(
                `┌ ❏ ◆ ⌜🦠 𝗖𝗢𝗩𝗜𝗗-19: ${(d.country||"WORLD").toUpperCase()}⌟ ◆\n│\n` +
                `├◆ 🔴 Cases: ${(d.cases||0).toLocaleString()}\n` +
                `├◆ 💀 Deaths: ${(d.deaths||0).toLocaleString()}\n` +
                `├◆ 💚 Recovered: ${(d.recovered||0).toLocaleString()}\n` +
                `├◆ 🏥 Active: ${(d.active||0).toLocaleString()}\n` +
                `├◆ 🧪 Tests: ${(d.tests||0).toLocaleString()}\n└ ❏` + config.footer
            );
        } catch(e) {
            reply(`❌ Could not fetch COVID stats for "${country}".\nTry: .covid nigeria | .covid world`);
        }
    }
};
