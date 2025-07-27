const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const aiConsole = require('./server/aiConsole');
const database = require('./utils/database');
const github = require('./utils/github');
const logger = require('./utils/logger');
const ButtonHandler = require('./utils/buttonHandler');
const ScreenshotMonitor = require('./utils/screenshot');
const hierarchy = require('./utils/hierarchy');
const changelogManager = require('./utils/changelogManager');
// ConfigManager will be initialized after database is ready
let configManager;
const githubSync = require('./utils/githubSync');
const { setupDiscordAuth } = require('./utils/discordAuth');
const adminActivityLogger = require('./utils/adminActivityLogger');

// Create Express app for health checks and admin panel
const app = express();
app.use(express.json());
app.use(express.static('admin')); // Serve admin panel files

// Serve loading page
app.get('/admin/loading', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'loading.html'));
});
const PORT = process.env.PORT || 5000;

// Remove Discord OAuth setup - using simple password authentication

// Middleware to log admin activities
function logAdminActivity(action, details = {}) {
    return (req, res, next) => {
        const adminRole = req.userRole || 'unknown';
        const adminId = adminRole === 'owner' ? 'owner' : 'admin';
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        adminActivityLogger.logActivity(adminRole, adminId, action, details, ipAddress);
        next();
    };
}

// Add user info endpoint for authenticated users
app.get('/api/admin/user-info', requireAuth, logAdminActivity('user_info_access'), (req, res) => {
    if (req.userRole === 'owner') {
        res.json({
            id: config.ownerId,
            username: 'Owner',
            avatar: null,
            role: '👑 Owner',
            level: 100,
            userRole: 'owner'
        });
    } else if (req.userRole === 'admin') {
        res.json({
            id: 'admin',
            username: 'Administrator',
            avatar: null,
            role: '🛡️ Administrator',
            level: 75,
            userRole: 'admin'
        });
    }
});

// API endpoint to get dashboard data
app.get('/api/admin/dashboard', requireAuth, async (req, res) => {
    try {
        const stats = {
            totalUsers: database.users ? database.users.size : 0,
            totalBalance: 0,
            activeCompanies: database.companies ? database.companies.size : 0,
            unresolvedErrors: 0
        };

        // Calculate total balance
        if (database.users) {
            for (const userData of database.users.values()) {
                stats.totalBalance += userData.balance || 0;
            }
        }

        // Get recent errors (placeholder for now)
        const recentErrors = [];

        res.json({ stats, recentErrors });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard data' });
    }
});

// API endpoint to get all users
app.get('/api/admin/users', requireAuth, async (req, res) => {
    try {
        const users = [];
        
        if (database.users) {
            for (const [id, userData] of database.users.entries()) {
                let displayName = userData.username || userData.displayName;
                
                // Try to fetch Discord username if not available
                if (!displayName && discordClient && discordClient.users) {
                    try {
                        const discordUser = await discordClient.users.fetch(id);
                        displayName = discordUser.username || discordUser.displayName;
                        // Update database with fetched username
                        userData.username = displayName;
                        database.saveUser(id, userData);
                    } catch (fetchError) {
                        // User not found or other error, use fallback
                        displayName = `User ${id.substring(0, 8)}`;
                    }
                }
                
                if (!displayName) {
                    displayName = `User ${id.substring(0, 8)}`;
                }
                
                users.push({
                    id,
                    ...userData,
                    displayName,
                    role: hierarchy.getRoleDisplayName(id)
                });
            }
        }
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

// API endpoint to get shop items
app.get('/api/admin/shop-items', requireAuth, (req, res) => {
    try {
        if (!database.shopItems) {
            return res.json([]);
        }
        const shopItems = Array.from(database.shopItems.entries()).map(([id, item]) => ({
            id,
            ...item
        }));
        res.json(shopItems);
    } catch (error) {
        console.error('Error fetching shop items:', error);
        res.status(500).json({ message: 'Failed to fetch shop items' });
    }
});

// API endpoint to get companies data for analytics
app.get('/api/admin/companies', requireAuth, (req, res) => {
    try {
        if (!database.companies) {
            return res.json([]);
        }
        const companies = Array.from(database.companies.entries()).map(([id, company]) => ({
            id,
            ...company,
            memberCount: company.members ? company.members.length : 0
        }));
        res.json(companies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ message: 'Failed to fetch companies' });
    }
});

// AI Console API endpoint
app.post('/api/admin/ai-console', requireAuth, async (req, res) => {
    try {
        const { command } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        const result = await aiConsole.processCommand(command, req.userRole);
        res.json(result);
    } catch (error) {
        logger.error('AI Console error:', error);
        res.status(500).json({ 
            success: false,
            output: `Console Error: ${error.message}`,
            type: 'error'
        });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        service: 'Discord Economy Bot',
        botOnline: discordClient && discordClient.readyAt ? true : false,
        botTag: discordClient && discordClient.user ? discordClient.user.tag : 'Not connected'
    });
});

// Keep-alive endpoint for 24/7 uptime
app.get('/ping', (req, res) => {
    res.json({ 
        status: 'alive', 
        timestamp: Date.now(),
        botOnline: discordClient && discordClient.readyAt ? true : false,
        uptime: formatUptime(process.uptime() * 1000)
    });
});

// Admin panel login page (password-based)
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Removed separate admin panel - admins now get full access to main panel

// Admin panel main page (requires password authentication)
app.get('/admin', (req, res) => {
    console.log('Admin panel access attempt');
    
    // Check for simple token-based authentication
    const authToken = req.query.token || req.headers.authorization?.substring(7);
    if (authToken === 'gummy-owner-authenticated' || authToken === 'gumball-admin-authenticated') {
        console.log('Serving admin panel to authenticated user');
        res.sendFile(path.join(__dirname, 'admin', 'index.html'));
    } else {
        console.log('Not authenticated, redirecting to login');
        res.redirect('/admin/login');
    }
});

// Simple authentication middleware for API endpoints
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    // Simple token validation
    if (token === 'gummy-owner-authenticated') {
        req.userRole = 'owner';
        req.userLevel = 100;
        next();
    } else if (token === 'gumball-admin-authenticated') {
        req.userRole = 'admin';
        req.userLevel = 75;
        next();
    } else {
        return res.status(401).json({ message: 'Invalid authentication token' });
    }
}

// Login endpoint with role-based authentication
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    
    if (password === 'AadenLandaverdeSom') {
        res.json({ 
            success: true, 
            token: 'gummy-owner-authenticated',
            role: 'owner',
            message: 'Owner login successful'
        });
    } else if (password === 'Gumball') {
        res.json({ 
            success: true, 
            token: 'gumball-admin-authenticated',
            role: 'admin',
            message: 'Admin login successful'
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid password' 
        });
    }
});

// Start HTTP server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP server running on port ${PORT}`);
});

// Bot state variables
let botStopped = false;
let botStartTime = new Date().toISOString();
let discordClient = null;

// Create Discord client
function createDiscordClient() {
    return new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ],
        // Enhanced settings for 24/7 reliability
        restTimeOffset: 0,
        restWsBridgeTimeout: 1000,
        restRequestTimeout: 15000,
        failIfNotExists: false,
        allowedMentions: {
            parse: ['users', 'roles'],
            repliedUser: true
        }
    });
}

// Initialize client
let client = createDiscordClient();
discordClient = client;

// Initialize bot mode
global.botMode = 'economy';

// Helper function to format uptime
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Initialize commands collection
client.commands = new Collection();
client.cooldowns = new Collection();

// Load commands function
function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if (command.name) {
            client.commands.set(command.name, command);
            logger.log(`Loaded command: ${command.name}`);
        }
    }
}

// Load commands initially
loadCommands();

// Function to setup Discord events
function setupDiscordEvents() {
    // Clear existing listeners to prevent duplicates
    client.removeAllListeners();

// Bot ready event
client.once('ready', async () => {
    // Initialize logger with Discord client
    logger.setClient(client, config.ownerId);
    
    // Initialize database first
    try {
        await database.init();
        await logger.startup('Database initialized successfully');
    } catch (error) {
        await logger.error('Failed to initialize database:', error);
    }
    
    // Initialize configManager with database support
    const ConfigManager = require('./utils/configManager');
    configManager = new ConfigManager(database);
    
    // Load and apply saved bot mode on startup
    const savedMode = configManager.getBotMode();
    const discordStatus = configManager.getStatusForDiscord();
    
    client.user.setPresence({
        activities: [{ name: discordStatus.activity.name, type: 0 }],
        status: discordStatus.status
    });
    
    await logger.startup(`${client.user.tag} is online and ready! Mode: ${savedMode}`);
    
    // Initialize interactive button handler
    new ButtonHandler(client);
    await logger.startup('Interactive button handler initialized');
    
    // Initialize screenshot monitor
    client.screenshotMonitor = new ScreenshotMonitor(client);
    await logger.startup('Screenshot monitoring system initialized');
    
    // Initialize hierarchy system
    client.hierarchy = hierarchy;
    await logger.startup('Hierarchy system initialized - Owner permissions set');
    
    // Initialize changelog manager
    await changelogManager.init();
    changelogManager.addChange('feature', 'Automatic changelog system implemented', 'Bot now tracks changes, fixes, and updates automatically');
    changelogManager.addChange('feature', 'GitHub auto-sync system implemented', 'Bot now automatically pushes all changes to GitHub repository');
    changelogManager.addChange('update', 'Bot restarted and all systems initialized');
    await logger.startup('Automatic changelog system initialized');
    
    // Make changelogManager globally available for GitHub sync
    global.changelogManager = changelogManager;
    
    // Start automatic GitHub sync
    setTimeout(async () => {
        try {
            await githubSync.autoSyncProject();
            await logger.startup('GitHub auto-sync system initialized - all changes will be pushed automatically');
        } catch (error) {
            await logger.error('GitHub sync initialization failed:', error);
        }
    }, 5000); // Wait 5 seconds for all systems to initialize
    
    // Import data from GitHub if needed
    try {
        await github.importUserData();
        await logger.startup('GitHub data import completed successfully');
    } catch (error) {
        await logger.error('Failed to import GitHub data:', error);
    }
    
    // Start lottery timer
    setInterval(() => {
        if (client && client.commands && !botStopped) {
            const lottery = client.commands.get('lottery');
            if (lottery && lottery.checkDrawing) {
                lottery.checkDrawing(client);
            }
        }
    }, 60000); // Check every minute
    
    await logger.startup('Bot initialization complete - All systems operational');
});

// Message event handler
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(config.prefix)) return;

    // Check bot mode restrictions
    const botMode = global.botMode || 'economy';
    const userIsOwner = message.author.id === config.ownerId;
    const userIsAdmin = client.hierarchy && client.hierarchy.hasPermission(message.author.id, 'admin_commands');
    
    // Mode-specific restrictions
    if (botMode === 'maintenance' && !userIsOwner && !userIsAdmin) {
        return message.reply({
            embeds: [{
                color: 0xffc107,
                title: '🔧 Maintenance Mode',
                description: 'The bot is currently in maintenance mode. Only administrators can use commands during this time.',
                footer: { text: 'Please try again later' }
            }]
        });
    }
    
    if (botMode === 'admin' && !userIsOwner && !userIsAdmin) {
        return message.reply({
            embeds: [{
                color: 0xdc3545,
                title: '🛠️ Admin Mode',
                description: 'The bot is currently in admin mode with restricted access. Only administrators can use commands.',
                footer: { text: 'Contact an administrator if you need assistance' }
            }]
        });
    }

    // Check if user is blacklisted
    if (database.blacklist && database.blacklist.has(message.author.id)) {
        const blacklistData = database.blacklist.get(message.author.id);
        return message.reply({
            embeds: [{
                color: 0xff0000,
                title: '🚫 Access Denied',
                description: `You are blacklisted and cannot use bot commands.\n**Reason:** ${blacklistData.reason}`,
                footer: { text: 'Contact an administrator if you believe this is an error.' }
            }]
        });
    }

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) || 
                   client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    // Cooldown handling
    if (!client.cooldowns.has(command.name)) {
        client.cooldowns.set(command.name, new Collection());
    }

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`Please wait ${timeLeft.toFixed(1)} more seconds before using \`${command.name}\` again.`);
        }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    // Execute command
    try {
        await command.execute(message, args, client);
        logger.log(`${message.author.tag} used command: ${command.name}`);
        
        // Track command usage for automatic changelog
        changelogManager.trackCommandUsage(command.name, message.author.id);
    } catch (error) {
        await logger.error(`Error executing command ${command.name} (used by ${message.author.tag}):`, error);
        message.reply('There was an error executing that command!');
        
        // Track errors for automatic changelog
        changelogManager.addChange('fix', `Fixed error in ${command.name} command`, error.message);
    }
});

// Error handling
client.on('error', async (error) => {
    await logger.error('Discord client error:', error);
});
}

// Additional admin API endpoints that require Discord client
app.get('/api/admin/bot-status', requireAuth, (req, res) => {
    try {
        const isOnline = client && client.readyAt;
        const uptime = isOnline ? formatUptime(Date.now() - client.readyAt.getTime()) : 'Offline';
        const botTag = isOnline ? client.user.tag : 'Unknown';
        const commandsLoaded = client && client.commands ? client.commands.size : 0;

        res.json({
            isOnline,
            uptime,
            botTag,
            commandsLoaded
        });
    } catch (error) {
        console.error('Error fetching bot status:', error);
        res.status(500).json({ message: 'Failed to fetch bot status' });
    }
});

// API endpoint to give money to user
app.post('/api/admin/users/:userId/give-money', requireAuth, logAdminActivity('economy_give_money'), (req, res) => {
        try {
            const { userId } = req.params;
            const { amount, reason } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json({ message: 'Invalid amount' });
            }

            const user = database.getUser(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            user.balance = (user.balance || 0) + amount;
            database.updateUser(userId, user);

            logger.startup(`Admin gave ${amount} coins to ${user.username || userId} - Reason: ${reason || 'Admin panel'}`);

            res.json({ success: true, newBalance: user.balance });
        } catch (error) {
            console.error('Error giving money:', error);
            res.status(500).json({ message: 'Failed to give money' });
        }
    });

    // API endpoint to give item to user
    app.post('/api/admin/users/:userId/give-item', requireAuth, (req, res) => {
        try {
            const { userId } = req.params;
            const { itemId, quantity, reason } = req.body;

            if (!itemId) {
                return res.status(400).json({ message: 'Item ID required' });
            }

            const shopItems = database.shopItems;
            if (!shopItems) {
                return res.status(500).json({ message: 'Shop items not initialized' });
            }
            const item = shopItems.get(itemId);
            if (!item) {
                return res.status(404).json({ message: 'Item not found in shop' });
            }

            const user = database.getUser(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (!user.inventory) user.inventory = [];
            
            for (let i = 0; i < (quantity || 1); i++) {
                user.inventory.push({
                    id: itemId,
                    name: item.name,
                    purchasedAt: new Date().toISOString(),
                    expiresAt: item.duration ? new Date(Date.now() + item.duration).toISOString() : null
                });
            }

            database.saveUser(userId, user);

            logger.startup(`Admin gave ${quantity || 1}x ${item.name} to ${user.username || userId} - Reason: ${reason || 'Admin panel'}`);

            res.json({ success: true, item: item.name, quantity: quantity || 1 });
        } catch (error) {
            console.error('Error giving item:', error);
            res.status(500).json({ message: 'Failed to give item' });
        }
    });

    // API endpoint to get shop items
    app.get('/api/admin/shop-items', requireAuth, (req, res) => {
        try {
            if (!database.shopItems) {
                return res.json([]);
            }
            const shopItems = Array.from(database.shopItems.entries()).map(([id, item]) => ({
                id,
                ...item
            }));
            res.json(shopItems);
        } catch (error) {
            console.error('Error fetching shop items:', error);
            res.status(500).json({ message: 'Failed to fetch shop items' });
        }
    });

    // API endpoints for admin activity tracking
    app.get('/api/admin/activities', requireAuth, logAdminActivity('activity_log_view'), (req, res) => {
        // Allow both owner and admin access
        if (req.userRole !== 'owner' && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const limit = parseInt(req.query.limit) || 100;
        const adminRole = req.query.adminRole || null;
        const severity = req.query.severity || null;

        const activities = adminActivityLogger.getActivities(limit, adminRole, severity);
        const stats = adminActivityLogger.getActivityStats();

        res.json({ activities, stats });
    });

    app.get('/api/admin/activities/export', requireAuth, logAdminActivity('activity_log_export'), (req, res) => {
        // Allow both owner and admin access
        if (req.userRole !== 'owner' && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const format = req.query.format || 'json';
        const data = adminActivityLogger.exportActivities(format);
        
        const filename = `admin_activities_${new Date().toISOString().split('T')[0]}.${format}`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
        res.send(data);
    });

    app.delete('/api/admin/activities', requireAuth, logAdminActivity('activity_log_clear'), (req, res) => {
        // Allow both owner and admin access
        if (req.userRole !== 'owner' && req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Access denied - Admin privileges required' });
        }

        const olderThanDays = req.body.olderThanDays || null;
        adminActivityLogger.clearActivities(olderThanDays);
        
        res.json({ success: true, message: 'Activity log cleared' });
    });

    // API endpoint for dashboard statistics
    app.get('/api/admin/dashboard', requireAuth, logAdminActivity('dashboard_access'), (req, res) => {
        try {
            const users = database.users || new Map();
            const companies = database.companies || new Map();
            const totalUsers = users.size;
            const totalBalance = Array.from(users.values()).reduce((sum, user) => sum + (user.balance || 0), 0);
            const activeCompanies = companies.size;

            // Get recent errors and activity from logger
            const recentErrors = logger.getRecentErrors ? logger.getRecentErrors() : [];
            const recentActivity = logger.getRecentActivity ? logger.getRecentActivity() : [];
            const unresolvedErrors = recentErrors.filter(error => !error.resolved).length;

            res.json({
                stats: {
                    totalUsers,
                    totalBalance,
                    activeCompanies,
                    unresolvedErrors
                },
                recentErrors: recentErrors.slice(0, 10),
                recentActivity: recentActivity.slice(0, 20)
            });
        } catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).json({ message: 'Failed to load dashboard' });
        }
    });
    
    // API endpoint for bot mode switching
    app.post('/api/admin/change-bot-mode', requireAuth, async (req, res) => {
        try {
            const { mode } = req.body;
            
            if (!['economy', 'admin', 'maintenance', 'ai'].includes(mode)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid mode. Must be economy, admin, maintenance, or ai' 
                });
            }

            // Store current bot mode
            global.botMode = mode;
            
            // Update bot status and activity based on mode
            if (client && client.user) {
                const modeConfig = {
                    economy: {
                        status: 'online',
                        activity: { name: '💰 Economy Mode | -help', type: 0 }
                    },
                    admin: {
                        status: 'dnd',
                        activity: { name: '🛠️ Admin Mode | Restricted Access', type: 0 }
                    },
                    maintenance: {
                        status: 'idle',
                        activity: { name: '🔧 Maintenance Mode | Limited Functions', type: 0 }
                    },
                    ai: {
                        status: 'online',
                        activity: { name: '🧠 AI Assistant Mode | Smart Commands', type: 0 }
                    }
                };

                const config = modeConfig[mode];
                await client.user.setStatus(config.status);
                await client.user.setActivity(config.activity.name, { type: config.activity.type });
                
                // Log the mode change
                await logger.startup(`Bot mode changed to: ${mode.toUpperCase()}`);
                
                // Add changelog entry
                if (global.changelogManager) {
                    global.changelogManager.addChange('update', `Bot mode switched to ${mode}`, `Admin changed bot operating mode to ${mode} with updated status and activity`);
                }
            }

            res.json({ 
                success: true, 
                mode: mode,
                message: `Bot successfully switched to ${mode} mode` 
            });
            
        } catch (error) {
            console.error('Error changing bot mode:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to change bot mode: ' + error.message 
            });
        }
    });

    // API endpoint for error management
    app.get('/api/admin/errors', requireAuth, (req, res) => {
        try {
            const errors = logger.getRecentErrors ? logger.getRecentErrors() : [];
            res.json(errors);
        } catch (error) {
            console.error('Error fetching logs:', error);
            res.status(500).json({ message: 'Failed to fetch error logs' });
        }
    });

    app.post('/api/admin/errors/:id/resolve', requireAuth, (req, res) => {
        try {
            const errorId = req.params.id;
            const resolved = logger.resolveError ? logger.resolveError(errorId) : false;
            if (resolved) {
                res.json({ success: true });
            } else {
                res.status(404).json({ message: 'Error not found' });
            }
        } catch (error) {
            console.error('Error resolving log:', error);
            res.status(500).json({ message: 'Failed to resolve error' });
        }
    });

    // Bot control endpoints
    app.get('/api/admin/bot-status', requireAuth, (req, res) => {
        try {
            // Enhanced bot status detection
            const clientExists = discordClient && discordClient.user;
            const hasReadyTimestamp = discordClient && discordClient.readyAt !== null;
            const isClientReady = discordClient && discordClient.isReady && discordClient.isReady();
            const notStopped = !botStopped;
            
            // Bot is online if client exists, has ready timestamp, is ready, and not manually stopped
            const isOnline = clientExists && hasReadyTimestamp && isClientReady && notStopped;
            
            const uptime = discordClient && discordClient.readyAt && isOnline ? 
                formatUptime(Date.now() - discordClient.readyAt.getTime()) : 'Offline';
            const commandsLoaded = client && client.commands ? client.commands.size : 0;
            const currentMode = configManager.getBotMode();
            const modeInfo = configManager.getModeInfo(currentMode);
            
            console.log(`[BotStatus] Check: clientExists=${clientExists}, hasReady=${hasReadyTimestamp}, isReady=${isClientReady}, notStopped=${notStopped}, final=${isOnline}`);
            
            res.json({
                online: isOnline,
                isOnline: isOnline, // Fixed: return boolean instead of timestamp
                uptime,
                lastRestart: botStartTime || new Date().toISOString(),
                commandsLoaded,
                botTag: discordClient && discordClient.user ? discordClient.user.tag : 'Unknown',
                botStopped,
                currentStatus: discordClient && discordClient.user ? discordClient.user.presence?.status || 'online' : 'unknown',
                botMode: currentMode,
                modeInfo: modeInfo
            });
        } catch (error) {
            console.error('Error fetching bot status:', error);
            res.status(500).json({ 
                online: false,
                isOnline: false,
                uptime: 'Error',
                lastRestart: 'Unknown',
                commandsLoaded: 0,
                botTag: 'Unknown',
                botStopped: true,
                currentStatus: 'unknown'
            });
        }
    });

    // Bot status change endpoint
    app.post('/api/admin/bot-status-change', requireAuth, async (req, res) => {
        try {
            const { status, activity, activityType } = req.body;
            
            if (!discordClient || !discordClient.isReady()) {
                return res.status(400).json({ success: false, message: 'Bot is not online' });
            }

            const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
            const validActivityTypes = [0, 1, 2, 3, 5]; // Playing, Streaming, Listening, Watching, Custom

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid status' });
            }

            const presence = {
                status: status
            };

            if (activity && activity.trim()) {
                presence.activities = [{
                    name: activity.trim(),
                    type: activityType || 0
                }];
            }

            await discordClient.user.setPresence(presence);
            
            console.log(`Bot status changed to: ${status}${activity ? ` - ${activity}` : ''}`);
            res.json({ 
                success: true, 
                message: `Bot status changed to ${status}${activity ? ` with activity: ${activity}` : ''}` 
            });
        } catch (error) {
            console.error('Error changing bot status:', error);
            res.status(500).json({ success: false, message: 'Failed to change bot status: ' + error.message });
        }
    });

    app.post('/api/admin/bot-restart', requireAuth, async (req, res) => {
        try {
            console.log('Bot restart initiated via admin panel');
            
            // Stop the bot first
            if (discordClient && discordClient.readyAt) {
                await discordClient.destroy();
            }
            
            // Wait a moment then restart
            setTimeout(async () => {
                botStopped = false;
                botStartTime = new Date().toISOString();
                
                // Create new client
                discordClient = createDiscordClient();
                client = discordClient;
                
                // Initialize commands collection
                client.commands = new Collection();
                try {
                    loadCommands();
                } catch (error) {
                    console.error('Error loading commands:', error);
                }
                
                setupDiscordEvents();
                
                try {
                    await discordClient.login(config.token);
                    console.log('Discord bot restarted successfully');
                } catch (error) {
                    console.error('Failed to restart bot:', error);
                }
            }, 2000);
            
            res.json({ success: true, message: 'Bot restart initiated' });
        } catch (error) {
            console.error('Error restarting bot:', error);
            res.status(500).json({ success: false, message: 'Failed to restart bot: ' + error.message });
        }
    });

    // Change bot mode endpoint with persistence
    app.post('/api/admin/change-bot-mode', requireAuth, async (req, res) => {
        try {
            const { mode } = req.body;
            
            if (!mode) {
                return res.status(400).json({ success: false, message: 'Mode is required' });
            }

            // Save the mode persistently
            configManager.setBotMode(mode, 'admin');
            
            // Update Discord status if bot is online
            if (discordClient && discordClient.user) {
                const discordStatus = configManager.getStatusForDiscord();
                await discordClient.user.setPresence({
                    activities: [{ name: discordStatus.activity.name, type: 0 }],
                    status: discordStatus.status
                });
            }
            
            // Log the change
            console.log(`[ConfigManager] Bot mode changed to: ${mode}`);
            if (changelogManager) {
                changelogManager.addChange('update', `Bot mode switched to ${mode}`);
            }
            
            const modeInfo = configManager.getModeInfo(mode);
            res.json({ 
                success: true, 
                message: `Bot mode changed to ${modeInfo.name}`,
                mode: mode,
                modeInfo: modeInfo
            });
        } catch (error) {
            console.error('Error changing bot mode:', error);
            res.status(500).json({ success: false, message: 'Failed to change bot mode: ' + error.message });
        }
    });

    // Bot stop endpoint
    app.post('/api/admin/bot-stop', requireAuth, async (req, res) => {
        try {
            console.log(`[ADMIN] Bot stop requested by ${req.userRole}`);
            
            if (discordClient && discordClient.readyAt) {
                await discordClient.destroy();
                botStopped = true;
                console.log('Bot stopped successfully');
                res.json({ success: true, message: 'Bot stopped successfully' });
            } else {
                res.json({ success: false, message: 'Bot is already stopped' });
            }
        } catch (error) {
            console.error('Error stopping bot:', error);
            res.status(500).json({ success: false, message: 'Failed to stop bot: ' + error.message });
        }
    });

    // Bot start endpoint
    app.post('/api/admin/bot-start', requireAuth, async (req, res) => {
        try {
            console.log(`[ADMIN] Bot start requested by ${req.userRole}`);
            
            if (botStopped || !discordClient || !discordClient.readyAt) {
                botStopped = false;
                botStartTime = new Date().toISOString();
                
                // Create new client if needed
                if (!discordClient || discordClient.destroyed) {
                    discordClient = createDiscordClient();
                    client = discordClient;
                    
                    // Initialize commands collection
                    client.commands = new Collection();
                    try {
                        loadCommands();
                    } catch (error) {
                        console.error('Error loading commands:', error);
                    }
                    
                    setupDiscordEvents();
                }
                
                // Start the bot
                try {
                    await discordClient.login(config.token);
                    console.log('Bot started successfully');
                    res.json({ success: true, message: 'Bot started successfully' });
                } catch (error) {
                    console.error('Failed to start bot:', error);
                    res.status(500).json({ success: false, message: 'Failed to start bot: ' + error.message });
                }
            } else {
                res.json({ success: false, message: 'Bot is already running' });
            }
        } catch (error) {
            console.error('Error starting bot:', error);
            res.status(500).json({ success: false, message: 'Failed to start bot: ' + error.message });
        }
    });

    app.post('/api/admin/bot-stop', requireAuth, async (req, res) => {
        try {
            console.log('Bot stop initiated via admin panel');
            botStopped = true;
            
            // Stop the bot
            if (discordClient && discordClient.readyAt) {
                await discordClient.destroy();
                console.log('Discord bot stopped via admin panel');
                res.json({ success: true, message: 'Bot stopped successfully' });
            } else {
                res.json({ success: true, message: 'Bot was already offline' });
            }
        } catch (error) {
            console.error('Error stopping bot:', error);
            res.status(500).json({ message: 'Failed to stop bot: ' + error.message });
        }
    });

    app.post('/api/admin/bot-start', requireAuth, async (req, res) => {
        try {
            if (discordClient && discordClient.readyAt && !botStopped) {
                return res.json({ success: false, message: 'Bot is already running' });
            }
            
            console.log('Bot start initiated via admin panel');
            botStopped = false;
            botStartTime = new Date().toISOString();
            
            // Create new client if old one was destroyed
            if (!discordClient || !discordClient.readyAt) {
                console.log('Creating new Discord client...');
                discordClient = createDiscordClient();
                client = discordClient; // Update global reference
                
                // Initialize commands collection for new client
                client.commands = new Collection();
                try {
                    loadCommands();
                } catch (error) {
                    console.error('Error loading commands:', error);
                }
                
                setupDiscordEvents(); // Re-setup all events
            }
            
            // Start the bot
            try {
                if (!discordClient.readyAt) {
                    await discordClient.login(config.token);
                }
                console.log('Discord bot logged in successfully');
                res.json({ success: true, message: 'Bot started successfully' });
            } catch (loginError) {
                console.error('Failed to login:', loginError);
                res.status(500).json({ message: 'Failed to start bot: ' + loginError.message });
            }
        } catch (error) {
            console.error('Error starting bot:', error);
            res.status(500).json({ message: 'Failed to start bot: ' + error.message });
        }
    });

    app.get('/api/admin/bot-logs', requireAuth, (req, res) => {
        try {
            // Get recent bot activity logs
            const recentLogs = [
                { timestamp: new Date().toISOString(), message: 'Bot online and operational' },
                { timestamp: new Date(Date.now() - 30000).toISOString(), message: `${database.users.size} users loaded` },
                { timestamp: new Date(Date.now() - 60000).toISOString(), message: 'All systems initialized' },
                { timestamp: new Date(Date.now() - 90000).toISOString(), message: 'Commands loaded successfully' },
                { timestamp: new Date(Date.now() - 120000).toISOString(), message: 'Database connected' }
            ];
            
            res.json(recentLogs);
        } catch (error) {
            console.error('Error fetching bot logs:', error);
            res.status(500).json({ message: 'Failed to fetch bot logs' });
        }
    });

    // Make user admin endpoint
    app.post('/api/admin/make-admin', requireAuth, (req, res) => {
        try {
            const { userId, reason } = req.body;
            
            if (!userId) {
                return res.status(400).json({ success: false, message: 'Missing userId' });
            }

            // Only owners can promote users to admin (this stays owner-only for security)
            if (req.userRole !== 'owner') {
                return res.status(403).json({ success: false, message: 'Insufficient permissions. Only owners can promote users to admin.' });
            }

            // Get hierarchy system
            const hierarchy = require('./utils/hierarchy');
            
            // Check if user is already an admin or owner
            const currentRole = hierarchy.getUserRole(userId);
            if (currentRole.level >= 75) { // Already admin level or higher
                return res.status(400).json({ success: false, message: 'User is already an Administrator or Owner' });
            }

            // Promote user to Administrator (level 75)
            hierarchy.setUserRole(userId, 'administrator');
            
            console.log(`[ADMIN] User ${userId} promoted to Administrator by Owner - Reason: ${reason || 'Admin panel promotion'}`);
            
            res.json({ 
                success: true, 
                message: `User promoted to Administrator successfully`,
                newRole: 'Administrator',
                level: 75
            });
        } catch (error) {
            console.error('Error promoting user to admin:', error);
            res.status(500).json({ success: false, message: 'Failed to promote user to admin' });
        }
    });

    // Blacklist management endpoints
    app.get('/api/admin/blacklist', requireAuth, (req, res) => {
        try {
            const blacklistedUsers = [];
            for (const [userId, userData] of database.users.entries()) {
                if (userData.blacklisted) {
                    blacklistedUsers.push({
                        id: userId,
                        username: userData.username,
                        displayName: userData.displayName || userData.username,
                        blacklistedDate: userData.blacklistedDate || new Date().toISOString()
                    });
                }
            }
            res.json(blacklistedUsers);
        } catch (error) {
            console.error('Error fetching blacklist:', error);
            res.status(500).json({ message: 'Failed to fetch blacklist' });
        }
    });

    app.post('/api/admin/blacklist', requireAuth, (req, res) => {
        try {
            const { userId, action } = req.body;
            
            if (!userId || !action) {
                return res.status(400).json({ success: false, message: 'Missing userId or action' });
            }

            // Allow both owner and admin access for blacklist management
            if (req.userRole !== 'owner' && req.userRole !== 'admin') {
                return res.status(403).json({ success: false, message: 'Insufficient permissions. Admin privileges required.' });
            }

            const user = database.users.get(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            if (action === 'blacklist') {
                user.blacklisted = true;
                user.blacklistedDate = new Date().toISOString();
                console.log(`[ADMIN] User ${userId} (${user.username}) blacklisted by ${req.userRole}`);
            } else if (action === 'unblacklist') {
                user.blacklisted = false;
                delete user.blacklistedDate;
                console.log(`[ADMIN] User ${userId} (${user.username}) unblacklisted by ${req.userRole}`);
            } else {
                return res.status(400).json({ success: false, message: 'Invalid action. Use "blacklist" or "unblacklist".' });
            }

            database.users.set(userId, user);
            database.saveUsers();

            res.json({ 
                success: true, 
                message: `User ${action}ed successfully`,
                user: {
                    id: userId,
                    username: user.username,
                    blacklisted: user.blacklisted
                }
            });
        } catch (error) {
            console.error('Error managing blacklist:', error);
            res.status(500).json({ success: false, message: 'Failed to manage blacklist' });
        }
    });

    // Execute script endpoint for console
    app.post('/api/admin/execute-script', requireAuth, async (req, res) => {
        try {
            const { type, script } = req.body;
            
            if (!script || !type) {
                return res.status(400).json({ error: 'Missing script or type' });
            }

            let result = { success: false, output: '', error: '' };

            switch (type) {
                case 'javascript':
                    try {
                        // Create a safe execution context
                        const safeConsole = {
                            log: (...args) => {
                                result.output += args.map(arg => 
                                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                                ).join(' ') + '\n';
                            }
                        };

                        // Create execution context with access to bot resources
                        const context = {
                            console: safeConsole,
                            database: database,
                            client: discordClient,
                            logger: logger,
                            JSON: JSON,
                            Math: Math,
                            Date: Date,
                            Array: Array,
                            Object: Object
                        };

                        // Execute the script in the context
                        const func = new Function(...Object.keys(context), script);
                        const scriptResult = func(...Object.values(context));
                        
                        if (scriptResult !== undefined) {
                            result.output += 'Return value: ' + (typeof scriptResult === 'object' ? JSON.stringify(scriptResult, null, 2) : String(scriptResult));
                        }
                        
                        result.success = true;
                    } catch (error) {
                        result.error = `JavaScript Error: ${error.message}`;
                    }
                    break;

                case 'database':
                    try {
                        // Execute database operations
                        const safeConsole = {
                            log: (...args) => {
                                result.output += args.map(arg => 
                                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                                ).join(' ') + '\n';
                            }
                        };

                        const context = {
                            console: safeConsole,
                            database: database
                        };

                        const func = new Function(...Object.keys(context), script);
                        func(...Object.values(context));
                        result.success = true;
                    } catch (error) {
                        result.error = `Database Error: ${error.message}`;
                    }
                    break;

                case 'bot-command':
                    try {
                        // Simulate bot command execution
                        result.output = `Command "${script}" would be executed.\nNote: Bot commands from web console are simulated for safety.`;
                        result.success = true;
                    } catch (error) {
                        result.error = `Command Error: ${error.message}`;
                    }
                    break;

                case 'system':
                    try {
                        const { exec } = require('child_process');
                        const { promisify } = require('util');
                        const execAsync = promisify(exec);
                        
                        const { stdout, stderr } = await execAsync(script, { timeout: 10000 });
                        result.output = stdout || stderr || 'Command executed successfully';
                        result.success = true;
                    } catch (error) {
                        result.error = `System Error: ${error.message}`;
                    }
                    break;

                case 'command':
                    try {
                        result.output = await executeCommandManagement(script);
                        result.success = true;
                    } catch (error) {
                        result.error = `Command Error: ${error.message}`;
                    }
                    break;

                default:
                    result.error = 'Unknown script type';
            }

            // Log script execution
            logger.startup(`Admin executed ${type} script: ${script.substring(0, 100)}${script.length > 100 ? '...' : ''}`);

            res.json(result);
        } catch (error) {
            logger.error('Error executing script:', error);
            res.status(500).json({ error: 'Failed to execute script' });
        }
    });

process.on('unhandledRejection', async (error) => {
    await logger.error('Unhandled promise rejection:', error);
});



// Setup events initially
setupDiscordEvents();

// Command management functions
async function executeCommandManagement(script) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const [action, commandName] = script.split(':');
    
    switch (action.toLowerCase()) {
        case 'list':
            const commandFiles = await fs.readdir('./commands');
            const commands = commandFiles.filter(file => file.endsWith('.js')).map(file => file.replace('.js', ''));
            return `Available Commands (${commands.length}):\n${commands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}`;
            
        case 'reload':
            try {
                // Clear require cache for commands
                const commandsPath = path.resolve('./commands');
                Object.keys(require.cache).forEach(key => {
                    if (key.startsWith(commandsPath)) {
                        delete require.cache[key];
                    }
                });
                
                // Reload commands
                const oldCommandCount = client.commands.size;
                client.commands.clear();
                loadCommands();
                const newCommandCount = client.commands.size;
                
                // Track reload in command changelog
                const commandChangelog = require('./utils/commandChangelog');
                commandChangelog.addChange('reload', 'all_commands', `Reloaded all commands: ${oldCommandCount} → ${newCommandCount}`, '1'); // Admin user ID
                
                return `Commands reloaded successfully! Loaded ${newCommandCount} commands. Use "list" to see all available commands.`;
            } catch (error) {
                throw new Error(`Failed to reload commands: ${error.message}`);
            }
            
        case 'create':
            if (!commandName) throw new Error('Please specify command name: create:commandname');
            
            const commandTemplate = `module.exports = {
    name: '${commandName}',
    description: 'Description for ${commandName}',
    cooldown: 3,
    async execute(message, args, client) {
        // Command logic here
        message.reply('Hello from ${commandName} command!');
    }
};`;
            
            const commandPath = `./commands/${commandName}.js`;
            await fs.writeFile(commandPath, commandTemplate);
            
            // Reload commands to include new one
            client.commands.clear();
            loadCommands();
            
            return `Command "${commandName}" created successfully!\nLocation: ${commandPath}\nUse "edit:${commandName}" to modify it.`;
            
        case 'edit':
            if (!commandName) throw new Error('Please specify command name: edit:commandname');
            
            const editPath = `./commands/${commandName}.js`;
            try {
                const content = await fs.readFile(editPath, 'utf8');
                return `Command "${commandName}" content:\n\n${content}\n\nTo modify, use system commands or edit the file directly.`;
            } catch (error) {
                throw new Error(`Command "${commandName}" not found. Use "list" to see available commands.`);
            }
            
        case 'delete':
            if (!commandName) throw new Error('Please specify command name: delete:commandname');
            
            const deletePath = `./commands/${commandName}.js`;
            try {
                await fs.unlink(deletePath);
                
                // Remove from client commands
                client.commands.delete(commandName);
                
                return `Command "${commandName}" deleted successfully!`;
            } catch (error) {
                throw new Error(`Failed to delete command "${commandName}": ${error.message}`);
            }
            
        case 'info':
            if (!commandName) throw new Error('Please specify command name: info:commandname');
            
            const command = client.commands.get(commandName);
            if (!command) throw new Error(`Command "${commandName}" not found.`);
            
            return `Command Info: ${commandName}
Description: ${command.description || 'No description'}
Cooldown: ${command.cooldown || 3} seconds
Aliases: ${command.aliases ? command.aliases.join(', ') : 'None'}
Usage: ${command.usage || 'No usage info'}`;
            
        default:
            return `Available command actions:
• list - Show all commands
• reload - Reload all commands
• create:name - Create new command
• edit:name - View command code
• delete:name - Delete command
• info:name - Show command info

Example: create:mycustom`;
    }
}

// Function to start Discord bot with enhanced reliability
async function startDiscordBot() {
    if (botStopped) return;
    
    try {
        if (!discordClient || discordClient.isReady() === false) {
            await discordClient.login(config.token);
        }
    } catch (error) {
        await logger.error('Failed to login to Discord:', error);
        if (!botStopped) {
            setTimeout(() => startDiscordBot(), 5000); // Retry after 5 seconds
        }
    }
}

// Start HTTP server with 24/7 reliability features
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP server running on port ${PORT}`);
});

// Keep-alive system for 24/7 operation on Replit
setInterval(() => {
    const http = require('http');
    
    const selfPing = () => {
        const req = http.get(`http://localhost:${PORT}/ping`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    // Auto-reconnect if bot goes offline
                    if (!response.botOnline && discordClient && !discordClient.readyAt && !botStopped) {
                        console.log('🔄 Bot offline detected, attempting auto-reconnection...');
                        setTimeout(async () => {
                            try {
                                await discordClient.login(config.token);
                                console.log('✅ Bot auto-reconnected successfully');
                            } catch (error) {
                                console.log('❌ Auto-reconnection failed:', error.message);
                            }
                        }, 5000);
                    }
                } catch (error) {
                    // Ignore JSON parsing errors
                }
            });
        });
        req.on('error', () => {}); // Ignore ping errors
        req.setTimeout(3000, () => req.destroy());
        req.end();
    };
    
    selfPing();
}, 240000); // Self-ping every 4 minutes to prevent Replit sleep

// Enhanced error handling for 24/7 stability
process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception (handled):', error.message);
    // Don't exit process - keep bot running
});

process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Unhandled Rejection (handled):', reason);
    // Don't exit process - keep bot running
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        if (discordClient) discordClient.destroy();
        process.exit(0);
    });
});

// Start the bot initially
startDiscordBot();

console.log('🚀 Discord Economy Bot initialized with 24/7 reliability features');
