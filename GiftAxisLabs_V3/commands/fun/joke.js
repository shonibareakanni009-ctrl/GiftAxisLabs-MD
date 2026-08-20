const axios = require("axios");
module.exports = {
    name: "joke",
    alias: ["jokes"],
    async execute(sock, m, args, reply) {
        try {
            const res = await axios.get("https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist,sexist", { timeout: 10000 });
            if (res.data.type === "twopart") {
                reply(`😂 *Joke*:\n\n${res.data.setup}\n\n${res.data.delivery}`);
            } else {
                reply(`😂 *Joke*:\n\n${res.data.joke}`);
            }
        } catch (e) {
            const jokes = [
                "Why did the developer go broke? Because he used up all his cache.",
                "Why do programmers prefer dark mode? Because light attracts bugs.",
                "What's a programmer's favorite hangout place? Foo Bar.",
                "Why was the JavaScript developer sad? Because he didn't Node how to Express himself.",
                "How many programmers does it take to change a light bulb? None, that's a hardware problem."
            ];
            reply(`😂 *Joke*:\n\n${jokes[Math.floor(Math.random() * jokes.length)]}`);
        }
    }
};
