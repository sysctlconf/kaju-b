require('dotenv').config();

const config = require('./config');
const { handleMemeMessage } = require('./xpHandler');
const { handleProfile } = require('./commands/profile');
const { handleLeaderboard } = require('./commands/leaderboard');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', () => {
    console.log(`✅ CAJU Meme Bot is online as ${client.user.tag}`);
    client.user.setActivity('🐦 Watching memes...', { type: 3 });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const inCommandsChannel = message.channelId === config.COMMANDS_CHANNEL;
    const inMemeChannel = config.MEME_CHANNELS.includes(message.channelId);

    // --- Meme channels: award XP + send fence ---
    if (inMemeChannel) {
        await handleMemeMessage(message, client);
        return;
    }

    // --- Commands channel: respond to bot commands ---
    if (inCommandsChannel) {
        const cmd = message.content.trim().toLowerCase().split(/\s+/)[0];

        if (cmd === '!p') {
            await handleProfile(message);
            return;
        }

        if (cmd === '!rank') {
            await handleLeaderboard(message);
            return;
        }
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down CAJU Meme Bot...');
    client.destroy();
    process.exit(0);
});

client.login(config.TOKEN).catch(err => {
    console.error('❌ Failed to login:', err.message);
    process.exit(1);
});
