const config = require("../../config");
const fs = require("fs-extra");
const econPath = require("path").join(__dirname, "../../data/economy.json");
async function getDB() { await fs.ensureFile(econPath); return fs.readJson(econPath).catch(()=>({})); }
async function saveDB(db) { await fs.writeJson(econPath, db); }
function getUser(db,id) { if(!db[id]) db[id]={balance:0}; return db[id]; }
const bjGames = new Map();
const SUITS = ["♠","♥","♦","♣"];
const VALS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
function newDeck() { return SUITS.flatMap(s => VALS.map(v => ({s,v}))); }
function shuffle(d) { for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];} return d; }
function cVal(c) { if(["J","Q","K"].includes(c.v)) return 10; if(c.v==="A") return 11; return parseInt(c.v); }
function hVal(hand) { let v=hand.reduce((s,c)=>s+cVal(c),0); let a=hand.filter(c=>c.v==="A").length; while(v>21&&a-->0) v-=10; return v; }
function disp(hand) { return hand.map(c=>c.v+c.s).join("  "); }
module.exports = {
  name: "blackjack", alias: ["bj","21game"],
  description: "Play Blackjack against the dealer — bet money",
  category: "games",
  async execute(sock, m, args, reply) {
    const from = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const key = from + ":" + sender;
    const g = bjGames.get(key);
    const action = (args[0]||"").toLowerCase();
    if (g && (action==="hit"||action==="h"||action==="stand"||action==="s"||action==="double"||action==="d")) {
      if (action==="hit"||action==="h"||action==="double"||action==="d") {
        if (action==="double"||action==="d") g.bet *= 2;
        g.player.push(g.deck.pop());
        const pv = hVal(g.player);
        if (pv > 21 || action==="double"||action==="d") {
          if (pv > 21) {
            bjGames.delete(key);
            const db=await getDB(); const user=getUser(db,sender);
            user.balance = Math.max(0,(user.balance||0)-g.bet); await saveDB(db);
            return reply("🃏 Your: " + disp(g.player) + " = " + pv + "\n\n💥 BUST! Lost $" + g.bet + "\n💳 $" + user.balance + config.footer);
          }
          while(hVal(g.dealer)<17) g.dealer.push(g.deck.pop());
          const dv=hVal(g.dealer); bjGames.delete(key);
          const db=await getDB(); const user=getUser(db,sender);
          if(dv>21||pv>dv){user.balance=(user.balance||0)+g.bet;reply("🃏 Your: "+disp(g.player)+" = "+pv+"\n🏠 Dealer: "+disp(g.dealer)+" = "+dv+"\n\n🎉 WIN! +$"+g.bet+"\n💳 $"+user.balance+config.footer);}
          else if(pv===dv){reply("🃏 Your: "+disp(g.player)+" = "+pv+"\n🏠 Dealer: "+disp(g.dealer)+" = "+dv+"\n\n🤝 Push — bet returned\n💳 $"+user.balance+config.footer);}
          else{user.balance=Math.max(0,(user.balance||0)-g.bet);reply("🃏 Your: "+disp(g.player)+" = "+pv+"\n🏠 Dealer: "+disp(g.dealer)+" = "+dv+"\n\n💸 Lost $"+g.bet+"\n💳 $"+user.balance+config.footer);}
          await saveDB(db); return;
        }
        return reply("🃏 Your: " + disp(g.player) + " = " + hVal(g.player) + "\n🏠 Dealer: " + g.dealer[0].v+g.dealer[0].s + " + ??\n\n.blackjack hit | stand | double" + config.footer);
      }
      while(hVal(g.dealer)<17) g.dealer.push(g.deck.pop());
      const pv=hVal(g.player); const dv=hVal(g.dealer); bjGames.delete(key);
      const db=await getDB(); const user=getUser(db,sender);
      let msg;
      if(dv>21||pv>dv){user.balance=(user.balance||0)+g.bet;msg="🎉 YOU WIN! +$"+g.bet;}
      else if(pv===dv){msg="🤝 PUSH — bet returned";}
      else{user.balance=Math.max(0,(user.balance||0)-g.bet);msg="💸 DEALER WINS. -$"+g.bet;}
      await saveDB(db);
      reply("🃏 Your: "+disp(g.player)+" = "+pv+"\n🏠 Dealer: "+disp(g.dealer)+" = "+dv+"\n\n"+msg+"\n💳 $"+user.balance+config.footer);
      return;
    }
    const bet = parseInt(args[0]);
    if (!bet || bet < 10) return reply("Usage: .blackjack <bet>  (min $10)\nThen: .blackjack hit | stand | double");
    const db=await getDB(); const user=getUser(db,sender);
    if((user.balance||0)<bet) return reply("Not enough! Balance: $"+(user.balance||0));
    const deck=shuffle(newDeck());
    const player=[deck.pop(),deck.pop()]; const dealer=[deck.pop(),deck.pop()];
    bjGames.set(key,{deck,player,dealer,bet});
    const pv=hVal(player);
    if(pv===21){bjGames.delete(key);const reward=Math.floor(bet*1.5);user.balance=(user.balance||0)+reward;await saveDB(db);return reply("🃏 "+disp(player)+" = *21*\n\n🎰 BLACKJACK! +$"+reward+"\n💳 $"+user.balance+config.footer);}
    reply("┌ ❏ ◆ ⌜🃏 𝗕𝗟𝗔𝗖𝗞𝗝𝗔𝗖𝗞⌟ ◆\n│\n" +
      "├◆ 💰 Bet: $"+bet+"\n" +
      "├◆ 🃏 Your: "+disp(player)+" = "+pv+"\n" +
      "├◆ 🏠 Dealer: "+dealer[0].v+dealer[0].s+" + ??\n│\n" +
      "├◆ .blackjack hit (h)\n├◆ .blackjack stand (s)\n├◆ .blackjack double (d)\n└ ❏"+config.footer);
  }
};
