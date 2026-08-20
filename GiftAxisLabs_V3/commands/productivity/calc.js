module.exports = {
    name: "calc",
    async execute(sock, m, args, reply) {
        try { const res = eval(args.join(' ')); reply(`📊 Result: ${res}`); } catch(e) { reply('❌ Invalid Math Expression.'); }
    }
};
