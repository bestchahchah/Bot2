const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const changelogManager = require('../utils/changelogManager');
const config = require('../config');

module.exports = {
    name: 'changelog',
    aliases: ['updates', 'changes', 'patch'],
    description: 'View recent bot updates and changes',
    usage: '-changelog',
    cooldown: 5,
    
    async execute(message, args, client) {
        try {
            // Get recent changes from the automatic changelog system
            const recentChanges = await changelogManager.getRecentChanges(15);
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📝 Bot Changelog - Auto-Updated')
                .setDescription('**Recent Updates & Changes:**\n\n' + recentChanges.join('\n'))
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    {
                        name: '🔄 Automatic Updates',
                        value: 'This changelog is automatically updated when new features are added, bugs are fixed, or configurations change.',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Auto-Updated | Commands: ${client.commands ? client.commands.size : 'Unknown'} | Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            // Add navigation buttons
            const navigationButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('changelog_refresh')
                        .setLabel('🔄 Refresh')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('changelog_help')
                        .setLabel('❓ Help')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('changelog_commands')
                        .setLabel('📋 Commands')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setLabel('🔗 GitHub')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://github.com/bestchahchah/Bot2')
                );

            await message.reply({ embeds: [embed], components: [navigationButtons] });
            
        } catch (error) {
            console.error('Error fetching automatic changelog:', error);
            
            // Fallback to static changelog if automatic system fails
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('📝 Bot Changelog')
                .setDescription('**Automatic changelog system temporarily unavailable**\n\nRecent major updates include:\n• Interactive UI implementation\n• Company system enhancement\n• Gaming features expansion\n• Administration tools\n• Automatic changelog system')
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ 
                    text: `Commands: ${client.commands ? client.commands.size : 'Unknown'} | Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('changelog_help')
                        .setLabel('❓ Help')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('changelog_commands')
                        .setLabel('📋 Commands')
                        .setStyle(ButtonStyle.Success)
                );

            await message.reply({ embeds: [embed], components: [buttons] });
        }
    }
};