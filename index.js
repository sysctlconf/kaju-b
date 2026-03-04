require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const config = require('./config');
const { ensureFont } = require('./fontLoader');
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

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
    await ensureFont(); // downloads + registers PressStart2P if missing
    console.log(`✅ CAJU Meme Bot is online as ${client.user.tag}`);
    client.user.setActivity('🐦 Watching memes...', { type: 3 });
});

// ─── Buttons ──────────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'open_ticket') {
        await handleOpenTicket(interaction);
    } else if (interaction.customId.startsWith('close_ticket_')) {
        await handleCloseTicket(interaction);
    }
});

// ─── Messages ─────────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const cmd = message.content.trim().toLowerCase().split(/\s+/)[0];
    const inMeme = config.MEME_CHANNELS.includes(message.channelId);
    const inCommands = message.channelId === config.COMMANDS_CHANNEL;
    const isAdmin = message.member?.permissions?.has(8n) ?? false;  // ADMINISTRATOR

    // !setup-tickets works in ANY channel for admins
    if (cmd === '!setup-tickets') {
        if (!isAdmin) { await message.reply('❌ Admins only.'); return; }
        const ch = await client.channels.fetch(TICKET_CHANNEL).catch(() => null);
        if (!ch) { await message.reply(`❌ Ticket channel <#${TICKET_CHANNEL}> not found.`); return; }
        await sendTicketPanel(ch);
        await message.reply('✅ Ticket panel sent!');
        return;
    }

    if (inMeme) { await handleMemeMessage(message, client); return; }

    if (inCommands) {
        if (cmd === '!p') { await handleProfile(message); return; }
        if (cmd === '!rank') { await handleLeaderboard(message); return; }
    }
});

// ─── Shutdown ─────────────────────────────────────────────────────────────────
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    client.destroy();
    process.exit(0);
});

client.login(config.TOKEN).catch(err => {
    console.error('❌ Login failed:', err.message);
    process.exit(1);
});
