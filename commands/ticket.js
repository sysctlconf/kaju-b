const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder,
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// Ticket channel IDs are stored here to allow close lookups
const TICKET_CHANNEL = '1478781794592493628';

/**
 * Build the ticket panel image with kaju.png as a full background
 */
async function buildTicketPanelImage() {
    const W = 900, H = 350;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // --- Background: kaju.png ---
    try {
        const bgPath = path.join(__dirname, '..', 'kaju.png');
        const bg = await loadImage(bgPath);
        ctx.drawImage(bg, 0, 0, W, H);
    } catch {
        // fallback gradient
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#0d1117');
        grad.addColorStop(1, '#1a2030');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // Dark overlay for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
    ctx.fillRect(0, 0, W, H);

    // Glowing accent line at top
    const topLine = ctx.createLinearGradient(0, 0, W, 0);
    topLine.addColorStop(0, 'transparent');
    topLine.addColorStop(0.3, '#00e5ff');
    topLine.addColorStop(0.7, '#7c4dff');
    topLine.addColorStop(1, 'transparent');
    ctx.fillStyle = topLine;
    ctx.fillRect(0, 0, W, 3);

    // Glowing accent line at bottom
    ctx.fillStyle = topLine;
    ctx.fillRect(0, H - 3, W, 3);

    // Icon / emoji area
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🎫', W / 2, 90);

    // Title
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Support Tickets', W / 2, 148);

    // Subtitle glow
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('CAJU • Official Support System', W / 2, 183);

    // Divider line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(160, 205);
    ctx.lineTo(W - 160, 205);
    ctx.stroke();

    // Body text
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Need help? Click the button below to open a private ticket.', W / 2, 238);
    ctx.fillText('Our staff will assist you as soon as possible. 🐦', W / 2, 264);

    // Footer
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('CAJU Meme Bot  •  Tickets are private between you and staff', W / 2, H - 18);

    return canvas.toBuffer('image/png');
}

/**
 * Sends the ticket panel to the ticket channel.
 * Call this once with !setup-tickets or on bot start if panel not present.
 */
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

    await channel.send({
        files: [attachment],
        components: [row],
    });
}

/**
 * Handles the "Open a Ticket" button click.
 * Creates a private channel for the user.
 */
async function handleOpenTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const user = interaction.user;
    const member = interaction.member;

    // Check if user already has an open ticket
    const existingChannel = guild.channels.cache.find(
        ch => ch.name === `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    );
    if (existingChannel) {
        return interaction.editReply({
            content: `❌ You already have an open ticket: ${existingChannel}`,
        });
    }

    // Build permission overwrites
    // @everyone cannot see, user + admins can
    const permissionOverwrites = [
        {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
            ],
        },
        {
            id: guild.members.me.id, // bot itself
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        },
    ];

    // Give access to all admin roles (roles with Administrator or ManageGuild permission)
    guild.roles.cache.forEach(role => {
        if (
            role.permissions.has(PermissionFlagsBits.Administrator) ||
            role.permissions.has(PermissionFlagsBits.ManageGuild)
        ) {
            permissionOverwrites.push({
                id: role.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                ],
            });
        }
    });

    // Find the parent category of the ticket panel channel (if any)
    const ticketPanelChannel = guild.channels.cache.get(TICKET_CHANNEL);
    const categoryId = ticketPanelChannel?.parentId || null;

    // Create the private channel
    const safeUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const ticketChannel = await guild.channels.create({
        name: `ticket-${safeUsername}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        topic: `Ticket opened by ${user.tag} (${user.id})`,
        permissionOverwrites,
    });

    // Build the ticket welcome image
    const W = 800, H = 200;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background
    try {
        const bg = await loadImage(path.join(__dirname, '..', 'kaju.png'));
        ctx.drawImage(bg, 0, 0, W, H);
    } catch {
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#0d1117');
        grad.addColorStop(1, '#1a2030');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);

    // Top accent
    const accent = ctx.createLinearGradient(0, 0, W, 0);
    accent.addColorStop(0, 'transparent');
    accent.addColorStop(0.5, '#7c4dff');
    accent.addColorStop(1, 'transparent');
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, 3);

    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`🎫 Ticket — ${user.username}`, W / 2, 65);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('Describe your issue below. Staff will be with you shortly.', W / 2, 105);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Click 🔒 Close Ticket when your issue is resolved.', W / 2, 145);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('CAJU Support System', W / 2, H - 15);

    const welcomeImg = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome.png' });

    // Close button row
    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`close_ticket_${user.id}`)
            .setLabel('Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
    );

    await ticketChannel.send({
        content: `${member} Welcome! Staff will be with you soon.`,
        files: [welcomeImg],
        components: [closeRow],
    });

    await interaction.editReply({
        content: `✅ Your ticket has been opened! ${ticketChannel}`,
    });
}

/**
 * Handles the "Close Ticket" button click.
 */
async function handleCloseTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;
    const guild = interaction.guild;

    // Confirm the channel is a ticket
    if (!channel.name.startsWith('ticket-')) {
        return interaction.editReply({ content: '❌ This is not a ticket channel.' });
    }

    // Only the ticket owner or admins can close
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const ownerId = channel.topic?.match(/\((\d+)\)/)?.[1];
    const isOwner = interaction.user.id === ownerId;

    if (!isAdmin && !isOwner) {
        return interaction.editReply({ content: '❌ Only the ticket owner or staff can close this.' });
    }

    await interaction.editReply({ content: '🔒 Closing ticket in 5 seconds...' });

    // Send closing message
    await channel.send('🔒 **This ticket is being closed.** Channel will be deleted in 5 seconds.');

    setTimeout(async () => {
        await channel.delete().catch(console.error);
    }, 5000);
}

module.exports = { sendTicketPanel, handleOpenTicket, handleCloseTicket, TICKET_CHANNEL };
