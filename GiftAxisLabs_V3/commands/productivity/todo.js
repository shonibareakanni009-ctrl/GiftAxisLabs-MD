module.exports = {
    name: "todo",
    async execute(sock, m, args, reply) {
        if(!args[0]) return reply('📝 Use: .todo [task]'); reply('✅ Task Added to your list: ' + args.join(' '));
    }
};
