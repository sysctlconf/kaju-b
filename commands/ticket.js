const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder,
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const config = require('../config');
const { ensureFont, FONT_FAMILY } = require('../fontLoader');

const TICKET_CHANNEL = '1478781794592493628';

// ── panel image ───────────────────────────────────────────────────────────────
async function buildTicketPanelImage() {
    const font = await ensureFont();
    const W = 900, H = 450;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // background = image0.png
    try {
        const bg = await loadImage(path.join(__dirname, '..', config.TICKET_BG));
        ctx.drawImage(bg, 0, 0, W, H);
    } catch {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);
    }

    // subtle dark overlay so text is legible
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, W, H);

    // title
    ctx.font = `bold 26px "${font}"`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SUPPORT TICKETS', W / 2, H / 2 - 30);

    // sub
    ctx.font = `12px "${font}"`;
    ctx.fillStyle = 'rgba(255,220,100,0.9)';
    ctx.fillText('Click the button to open a private ticket', W / 2, H / 2 + 30);

    return canvas.toBuffer('image/png');
}

async function sendTicketPanel(channel) {
    const imgBuf = await buildTicketPanelImage();
    const attachment = new AttachmentBuilder(imgBuf, { name: 'ticket-panel.png' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('Open a Ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary),
    );

    await channel.send({ files: [attachment], components: [row] });
}

// ── open ticket ───────────────────────────────────────────────────────────────
async function handleOpenTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const font = await ensureFont();

    const guild = interaction.guild;
    const user = interaction.user;
    const member = interaction.member;

    const safeName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}`;

    // prevent duplicate
    const existing = guild.channels.cache.find(ch => ch.name === safeName);
    if (existing) return interaction.editReply({ content: `❌ Already open: ${existing}` });

    // permissions
    const overrides = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ];
    guild.roles.cache.forEach(role => {
        if (role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.ManageGuild)) {
            overrides.push({ id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] });
        }
    });

    const panelCh = guild.channels.cache.get(TICKET_CHANNEL);
    const ticketChannel = await guild.channels.create({
        name: safeName,
        type: ChannelType.GuildText,
        parent: panelCh?.parentId || null,
        topic: `Ticket (${user.id})`,
        permissionOverwrites: overrides,
    });

    // welcome card
    const W = 800, H = 260;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    try {
        const bg = await loadImage(path.join(__dirname, '..', config.TICKET_BG));
        ctx.drawImage(bg, 0, 0, W, H);
    } catch {
        ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold 20px "${font}"`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TICKET OPENED', W / 2, H / 2 - 30);

    ctx.font = `11px "${font}"`;
    ctx.fillStyle = 'rgba(255,220,100,0.9)';
    ctx.fillText('Staff will assist you shortly.', W / 2, H / 2 + 20);

    ctx.font = `9px "${font}"`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Click Close Ticket when resolved.', W / 2, H / 2 + 55);

    const welcomeImg = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome.png' });

    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`close_ticket_${user.id}`)
            .setLabel('Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({ content: `${member} Welcome!`, files: [welcomeImg], components: [closeRow] });
    await interaction.editReply({ content: `✅ Ticket opened: ${ticketChannel}` });
}

// ── close ticket ──────────────────────────────────────────────────────────────
async function handleCloseTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel.name.startsWith('ticket-')) return interaction.editReply({ content: '❌ Not a ticket channel.' });

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const ownerId = channel.topic?.match(/\((\d+)\)/)?.[1];
    if (!isAdmin && interaction.user.id !== ownerId) {
        return interaction.editReply({ content: '❌ Only the ticket owner or staff can close this.' });
    }

    await interaction.editReply({ content: '🔒 Closing in 5s...' });
    await channel.send('🔒 Ticket closing...');
    setTimeout(() => channel.delete().catch(() => { }), 5000);
}

module.exports = { sendTicketPanel, handleOpenTicket, handleCloseTicket, TICKET_CHANNEL };
