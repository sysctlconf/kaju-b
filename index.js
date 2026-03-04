require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const config = require('./config');
const { handleMemeMessage } = require('./xpHandler');
const { handleProfile } = require('./commands/profile');
const { handleLeaderboard } = require('./commands/leaderboard');
const {
    sendTicketPanel,
    handleOpenTicket,
    handleCloseTicket,
    TICKET_CHANNEL,
} = require('./commands/ticket');

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

// ─── Button / Interaction handler ───────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        await handleOpenTicket(interaction);
    } else if (interaction.customId.startsWith('close_ticket_')) {
        await handleCloseTicket(interaction);
    }
});

// ─── Message handler ─────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const inCommandsChannel = message.channelId === config.COMMANDS_CHANNEL;
    const inMemeChannel = config.MEME_CHANNELS.includes(message.channelId);

    // Meme channels: award XP + send fence
    if (inMemeChannel) {
        await handleMemeMessage(message, client);
        return;
    }

    // Commands channel
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

        // Admin-only: send ticket panel to the ticket channel
        if (cmd === '!setup-tickets') {
            if (!message.member.permissions.has(8n)) { // 8n = ADMINISTRATOR
                await message.reply('❌ Admins only.');
                return;
            }
            const ticketCh = await client.channels.fetch(TICKET_CHANNEL).catch(() => null);
            if (!ticketCh) {
                await message.reply('❌ Ticket channel not found.');
                return;
            }
            await sendTicketPanel(ticketCh);
            await message.reply('✅ Ticket panel sent!');
            return;
        }
    }
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down CAJU Meme Bot...');
    client.destroy();
    process.exit(0);
});

client.login(config.TOKEN).catch(err => {
    console.error('❌ Failed to login:', err.message);
    process.exit(1);
});
