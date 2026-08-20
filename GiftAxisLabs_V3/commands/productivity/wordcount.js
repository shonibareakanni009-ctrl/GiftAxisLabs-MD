module.exports = {
    name: "wordcount",
    async execute(sock, m, args, reply) {
        reply(`📄 Word Count: ${args.length} words.`);
    }
};
