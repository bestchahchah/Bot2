const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class ChangelogManager {
    constructor() {
        this.changelogPath = path.join(__dirname, '../CHANGELOG.md');
        this.changes = [];
        this.autoSaveInterval = null;
    }

    async init() {
        // Start auto-save interval (every 5 minutes)
        this.autoSaveInterval = setInterval(() => {
            this.saveChanges();
        }, 5 * 60 * 1000);
        
        logger.log('Changelog manager initialized');
    }

    // Add a new change entry
    addChange(type, description, details = null) {
        const change = {
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }),
            type: type, // 'feature', 'fix', 'enhancement', 'update'
            description: description,
            details: details
        };

        this.changes.push(change);
        logger.log(`Changelog entry added: ${type} - ${description}`);

        // Auto-save immediately for important changes
        if (type === 'feature' || type === 'fix') {
            this.saveChanges();
        }
    }

    // Save accumulated changes to changelog file
    async saveChanges() {
        if (this.changes.length === 0) return;

        try {
            let changelog = '';
            
            // Try to read existing changelog
            try {
                changelog = await fs.readFile(this.changelogPath, 'utf8');
            } catch (error) {
                // Create new changelog if it doesn't exist
                changelog = `# Discord Economy Bot - Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

`;
            }

            // Group changes by date
            const changesByDate = this.groupChangesByDate(this.changes);
            
            // Generate new entries
            let newEntries = '';
            for (const [date, dayChanges] of Object.entries(changesByDate)) {
                newEntries += `## ${date}\n\n`;
                
                const groupedByType = this.groupChangesByType(dayChanges);
                
                for (const [type, typeChanges] of Object.entries(groupedByType)) {
                    const typeHeader = this.getTypeHeader(type);
                    newEntries += `### ${typeHeader}\n`;
                    
                    for (const change of typeChanges) {
                        newEntries += `- ${change.description}`;
                        if (change.details) {
                            newEntries += `\n  ${change.details}`;
                        }
                        newEntries += '\n';
                    }
                    newEntries += '\n';
                }
            }

            // Insert new entries after the [Unreleased] section
            const unreleasedIndex = changelog.indexOf('## [Unreleased]');
            if (unreleasedIndex !== -1) {
                const insertIndex = changelog.indexOf('\n', unreleasedIndex + 15) + 1;
                changelog = changelog.slice(0, insertIndex) + '\n' + newEntries + changelog.slice(insertIndex);
            } else {
                // Append to end if no unreleased section found
                changelog += '\n' + newEntries;
            }

            await fs.writeFile(this.changelogPath, changelog);
            logger.log(`Changelog updated with ${this.changes.length} new entries`);
            
            // Clear the changes buffer
            this.changes = [];
            
        } catch (error) {
            logger.error('Failed to update changelog:', error);
        }
    }

    groupChangesByDate(changes) {
        const grouped = {};
        for (const change of changes) {
            if (!grouped[change.date]) {
                grouped[change.date] = [];
            }
            grouped[change.date].push(change);
        }
        return grouped;
    }

    groupChangesByType(changes) {
        const grouped = {};
        for (const change of changes) {
            if (!grouped[change.type]) {
                grouped[change.type] = [];
            }
            grouped[change.type].push(change);
        }
        return grouped;
    }

    getTypeHeader(type) {
        const headers = {
            'feature': '🚀 New Features',
            'fix': '🐛 Bug Fixes',
            'enhancement': '✨ Enhancements',
            'update': '📝 Updates',
            'security': '🔒 Security',
            'performance': '⚡ Performance',
            'ui': '🎨 User Interface',
            'api': '🔧 API Changes'
        };
        return headers[type] || '📋 Other';
    }

    // Track command usage for automatic feature documentation
    trackCommandUsage(commandName, userId) {
        // Track popular commands for potential changelog entries
        if (!this.commandStats) {
            this.commandStats = {};
        }
        
        if (!this.commandStats[commandName]) {
            this.commandStats[commandName] = { count: 0, users: new Set() };
        }
        
        this.commandStats[commandName].count++;
        this.commandStats[commandName].users.add(userId);
    }

    // Track bot events for automatic changelog generation
    trackBotEvent(event, details) {
        const eventDescriptions = {
            'restart': 'Bot restarted successfully',
            'database_update': 'Database schema updated',
            'command_added': `New command added: ${details}`,
            'command_removed': `Command removed: ${details}`,
            'error_fixed': `Fixed error: ${details}`,
            'feature_enabled': `Feature enabled: ${details}`,
            'config_changed': `Configuration updated: ${details}`
        };

        if (eventDescriptions[event]) {
            this.addChange('update', eventDescriptions[event], details);
        }
    }

    // Get changelog content for the bot command
    async getRecentChanges(limit = 10) {
        try {
            const changelog = await fs.readFile(this.changelogPath, 'utf8');
            const lines = changelog.split('\n');
            const recentChanges = [];
            
            let currentSection = null;
            let changeCount = 0;
            
            for (const line of lines) {
                if (line.startsWith('## ') && !line.includes('[Unreleased]')) {
                    if (changeCount >= limit) break;
                    currentSection = line.replace('## ', '');
                    recentChanges.push(`**${currentSection}**`);
                } else if (line.startsWith('- ') && currentSection) {
                    if (changeCount >= limit) break;
                    recentChanges.push(line);
                    changeCount++;
                }
            }
            
            return recentChanges.slice(0, limit);
        } catch (error) {
            logger.error('Failed to read changelog:', error);
            return ['No changelog available'];
        }
    }

    // Add manual entry for testing
    addManualEntry(type, description, details = null) {
        this.addChange(type, description, details);
        this.saveChanges(); // Save immediately
    }

    // Cleanup on shutdown
    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        this.saveChanges(); // Save any pending changes
    }
}

module.exports = new ChangelogManager();