# Discord Economy Bot

## Overview

This is a Discord economy bot built with Discord.js v14 that provides a comprehensive virtual economy system for Discord servers. The bot includes currency management, gambling games, a shop system, lottery functionality, and administrative tools. The bot has been completely rebuilt with all requested features, GitHub data integration capabilities, and a fully interactive user interface using buttons and select menus.

**Status**: Interactive UI Implementation Complete (July 26, 2025) - All features now have interactive buttons and select menus instead of text-only responses.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Owner Panel "Make Admin" Feature Implementation (July 27, 2025)
- Added "Make Admin" button to Owner panel for promoting users to Administrator role
- Created secure API endpoint (/api/admin/make-admin) with owner-only permissions
- Integrated with existing hierarchy system to properly promote users to level 75 (Administrator)
- Enhanced user interface to show "Make Admin" button only for non-admin users
- Added confirmation dialogs and success/error feedback for admin promotions
- Owner can now promote any regular user to Administrator role through web interface
- Promoted users gain access to admin panel (password: "Gumball") and hierarchy management
- System prevents duplicate promotions and validates user permissions before promotion
- All admin promotions logged to console with timestamp and reason tracking
- Enhanced blacklist display to show current blacklist status in user management interface

### Bidirectional GitHub Data Sync Implementation (July 27, 2025)
- Enhanced GitHub sync system to automatically save user data changes back to repository
- Implemented automatic user data persistence to balances.json in GitHub repository
- Added scheduled sync system that batches user data changes to avoid API rate limits
- Created bidirectional data flow: imports from GitHub on startup, exports on data changes
- Updated database operations to trigger GitHub sync for user balance, inventory, and company changes
- User data now automatically syncs to GitHub 30 seconds after any balance/stats/inventory modifications
- Company data changes also automatically pushed to companies.json in repository  
- Fixed duplicate -daily command issue by updating screenshot monitor to ignore bot commands
- Enhanced screenshot monitoring trigger words to focus on genuine issues vs normal bot usage
- All user progress (balances, daily streaks, work history, shop purchases) now preserved in GitHub
- Bot maintains complete data integrity between local storage and GitHub repository backup

### Console & Command Management System (July 27, 2025)
- Added comprehensive Console/Output Panel to admin interface for executing custom scripts
- Created multi-type script execution system supporting JavaScript, Database, Bot Command, Command Management, and System types
- Built interactive console interface with real-time output display and color-coded results
- Implemented secure script execution backend with safe context isolation and error handling
- Added script templates for quick access to common operations and database queries
- Created console output with timestamp logging, auto-scroll, and clear functionality
- Built JavaScript execution context with access to bot database, Discord client, and logger
- Added database query execution for direct operations on user and company data
- Implemented system command execution with timeout protection and output capture
- Enhanced admin panel with professional console styling and monospace font display
- Added comprehensive command management system for creating, editing, and deleting bot commands
- Built command management with list, reload, create, edit, delete, and info operations
- Created command templates with automatic code generation and command reloading
- Console provides direct access to bot internals for advanced debugging and management
- Script execution logged to admin activity for audit trail and security monitoring
- Command management allows real-time bot command development through web interface

### Web Admin Panel System with Authentication (July 27, 2025)
- Created comprehensive web-based admin control panel at /admin route with secure login
- Built beautiful authentication page with password protection (password: "Gummy")
- Implemented token-based authentication system with auto-redirect to login page
- Built interactive dashboard with real-time bot statistics and user management
- Added economy management tools: give money and items to users through web interface
- Implemented user search and filtering capabilities with role-based access control
- Created responsive design with modern UI components, modal dialogs, and logout functionality
- Integrated with existing hierarchy system for proper permission validation
- Added real-time error monitoring and logging capabilities for bot debugging
- Built secure API endpoints with authentication middleware for all admin operations
- Enhanced user management to display Discord usernames instead of user IDs with automatic username fetching
- Added bot control panel allowing remote start/stop of Discord bot through web interface
- Created secure login/logout system with token-based authentication and protected API endpoints
- Integrated real-time bot status monitoring and control buttons in admin dashboard
- Fixed authentication issues causing "Failed to load dashboard" errors in admin panel
- Enhanced error handling for authentication failures and improved web interface stability  
- Bot control system now works reliably with proper Discord client management
- Website stays online consistently with improved authentication middleware
- Implemented Discord OAuth authentication system replacing password-based login
- Created Discord login page with automatic admin privilege detection
- Added Discord user info endpoints with avatar and role display
- Authentication now automatically recognizes Owner and Administrator roles from bot hierarchy
- Enhanced security with session-based authentication and proper Discord API integration
- Owner and admin users can now safely manage the bot through beautiful web interface with Discord login
- Added animated loading states for authentication process with smooth transitions and user feedback
- Implemented loading overlays, spinner animations, and status messages for better user experience
- Enhanced login flow with multi-stage loading indicators and error handling

### Bot Hierarchy System (July 27, 2025)
- Created comprehensive role-based permission system with 5 hierarchical levels
- Implemented Owner (Level 100), Administrator (Level 75), Moderator (Level 50), Trusted User (Level 25), and User (Level 1) roles
- Added hierarchy command (-hierarchy) for managing user roles and permissions
- Built permission checking system that validates access to all admin features
- Created interactive role management with buttons for list, assign, and permissions
- Owner can promote users to admin status and manage the entire hierarchy
- Each role has specific permissions: manage_users, manage_economy, admin_commands, etc.
- Integrated hierarchy system with existing admin commands for proper access control
- Added visual role displays with emojis and color coding throughout the bot interface

### Screenshot Monitoring System (July 27, 2025)
- Added comprehensive message monitoring system that detects specific trigger words
- Implemented visual screenshot generation using Canvas library with fallback support
- Created DM alert system that sends detailed message context when trigger words are detected
- Added screenshot command (-screenshot) for managing trigger words (owner only)
- Built interactive control panel with buttons for list, clear, and test functions
- System monitors all server messages and sends alerts with user info, server context, and direct message links
- Includes 10 default trigger words: error, crash, bug, issue, problem, help, support, admin, owner, report
- Canvas-based visual screenshots show message content with highlighted trigger words
- Fallback to text-only alerts if Canvas dependencies are unavailable

### Deployment Health Check Fix (July 27, 2025)
- Added Express.js HTTP server for Cloud Run deployment health checks
- Implemented health check endpoint at "/" returning JSON status with uptime and timestamp
- Server runs on port 5000 (0.0.0.0 binding) alongside Discord bot
- Added Express.js dependency via packager tool
- Fixed deployment failures by ensuring proper HTTP response for health checks
- Bot now supports both Discord functionality and web server requirements for cloud deployment

### Music Removal & Shop Enhancement (July 26, 2025)
- Completely removed all music functionality due to technical limitations in environment
- Removed play, skip, stop, queue, radio, and radiotest commands
- Uninstalled audio-related packages (@discordjs/voice, opusscript)
- Enhanced shop system with new categories: Pets (Dragon Egg, Phoenix Egg, Wolf Pup, Lucky Cat) and Luck Charms (Golden Horseshoe, Rabbit's Foot, Four-Leaf Clover, Enchanted Dice, Crystal Ball, Lucky Ace Card)  
- Removed Roles category from shop as inappropriate for economy bot
- Added rarity system for pets with visual indicators (⚪ Common, 🔵 Rare, 🟣 Epic, 🟡 Legendary)
- Shop now contains 12 items across 4 categories focused on economy gameplay
- Bot now has 13 core commands focused entirely on economy features

### Interactive UI Implementation (July 26, 2025)
- Converted all text-only responses to interactive button and select menu interfaces
- Created comprehensive ButtonHandler system for managing all user interactions
- Added contextual quick-action buttons to every major command
- Implemented category selectors, navigation buttons, and confirmation dialogs
- Enhanced user experience with clickable interfaces instead of typing commands
- All commands now support interactive elements: help navigation, shop purchasing, company management, lottery buying, leaderboard filtering
- Changed command prefix from "!" to "-" across all 17 commands
- Removed admin section from public help menu - now exclusive to owner dashboard
- Added public changelog command (-changelog) with interactive buttons
- Fixed all deprecated ephemeral warnings for cleaner console output

### Company System Integration (July 26, 2025)
- Successfully imported existing company data from GitHub repository
- Added complete company management system with create/join/leave functionality
- Implemented energy system with work requirements (10 energy per work)
- Added energy regeneration (1 point every 5 minutes)
- Created comprehensive profile command showing all user statistics
- Updated work command to consume energy and show remaining energy
- Loaded 2 existing companies: "Best" and "dem creations" with all members
- All 6 users retained their company associations and job positions

### GitHub Repository "Bot2" Created and Admin Panel Fixed (July 27, 2025)
- User successfully created GitHub repository "Bot2" at https://github.com/bestchahchah/Bot2
- Repository contains complete Discord Economy Bot with comprehensive documentation
- All 19 commands, web admin panel, and authentication system included
- Fixed admin panel authentication - user can now successfully log in with Discord OAuth
- Session management working properly with proper authentication state persistence
- Project structure organized with README, CONTRIBUTING, DEPLOYMENT, and CHANGELOG guides
- Configuration templates and setup instructions provided for easy deployment elsewhere
- Bot continues running 24/7 on Replit while repository serves as development backup
- Complete file structure with commands/, utils/, admin/, and documentation ready for collaboration

### Automatic Changelog Management System (July 27, 2025)
- Implemented comprehensive automatic changelog system that tracks all bot changes in real-time
- Created changelogManager.js utility that automatically detects and logs features, fixes, updates, and enhancements
- Built automatic changelog file generation (CHANGELOG.md) with categorized entries by date and type
- Enhanced -changelog command to read from auto-generated file instead of static content
- Added automatic tracking of command usage, bot events, errors, and feature additions
- Implemented auto-save functionality that updates changelog every 5 minutes
- Created changelog entry categorization: features, fixes, enhancements, updates, security, performance
- Added automatic bot event tracking for restarts, database updates, config changes, and error fixes
- Integrated changelog system with all bot operations to capture changes automatically
- Enhanced changelog command with refresh functionality to show latest updates
- System now maintains comprehensive change history without manual intervention
- All bot modifications are automatically documented with timestamps and details

### Enhanced Bot Status Display, Live Uptime, and Status Control Features (July 27, 2025)
- Fixed bot status endpoint to properly display command count and online status with accurate detection
- Enhanced console output system to eliminate "undefined" responses and show proper error handling
- Added colored console output with orange command text, green success results, and red error messages
- Fixed "Commands Loaded" display to show accurate real-time count (currently showing 20 commands)
- Improved bot status API to return both "online" and "isOnline" properties for compatibility
- Enhanced script execution response handling with fallback text for empty or undefined outputs
- Updated auto-refresh functionality for bot status every 5 seconds for live uptime updates
- Created proper console styling with distinct colors for commands, results, and errors
- Fixed console output formatting to display meaningful messages instead of "undefined"
- Improved error handling in bot status display with fallback values when API calls fail
- Enhanced command management system to properly track and display loaded command count
- All console operations now provide clear feedback with proper success/error indicators
- Fixed modal popup issue where give money/item modals appeared automatically on page refresh
- Added proper modal initialization system with hideAllModals() function on page load
- Enhanced modal management functions with proper show/hide/close functionality
- Implemented modal cleanup system that clears forms and messages when closing
- Fixed CSS styling to ensure modals are hidden by default with display: none
- All modals now only appear when triggered by user actions, not on page refresh
- Added "Change Bot Status" feature to Owner Panel with full Discord presence control
- Created bot status change modal with options for Online, Idle, DND, and Invisible states
- Implemented activity text and activity type settings (Playing, Streaming, Listening, Watching, Custom)
- Built bot status change API endpoint with validation and proper Discord client integration
- Enhanced uptime display to update continuously every 5 seconds showing live runtime
- Fixed offline status detection to properly show when bot is actually online vs offline
- Bot status now updates in real-time with accurate uptime counters and presence information

### Switch to Password Authentication System (July 27, 2025)
- Replaced Discord OAuth2 authentication with simple password-based login for admin panel
- Created new login.html with beautiful password input form and loading animations
- Updated all API endpoints to use Bearer token authentication instead of Discord sessions
- Built new password-admin.js with token-based authentication for all admin functions
- Simplified authentication flow: enter password "Gummy" → receive token → access admin panel
- Removed complex OAuth dependencies while maintaining all admin panel functionality
- Token stored in localStorage for persistent sessions across browser refreshes
- Admin panel now accessible via simple password instead of requiring Discord login
- All features working: user management, bot control, console system, error monitoring

### Complete Bot Rebuild (July 26, 2025)
- Built complete Discord economy bot from scratch with Discord.js v14
- Implemented all requested features: shop, work commands, gambling, daily rewards, leaderboards, lottery
- Added GitHub data integration for importing/exporting user data
- Created modular command system with cooldown management
- Implemented file-based database with in-memory caching
- Added comprehensive administrative tools
- Set up logging system and error handling

## System Architecture

### Backend Architecture
- **Framework**: Node.js with Discord.js v14
- **Architecture Pattern**: Command-based modular architecture
- **Data Storage**: File-based JSON storage system
- **External Integrations**: GitHub API integration for data import/export

### Core Components
1. **Command System**: Modular command loading with cooldown management
2. **Interactive UI System**: ButtonHandler managing all button and select menu interactions
3. **Database Layer**: Custom file-based database with in-memory caching
4. **Economy Engine**: Virtual currency system with user statistics tracking
5. **Game Systems**: Multiple gambling and entertainment modules with interactive controls
6. **Administrative Tools**: Server management and economy control features

## Key Components

### Command Structure
- Commands are organized in the `/commands` directory
- Each command is a separate module with execute function
- Built-in cooldown system and permission checking
- Support for command aliases and help documentation
- Interactive UI components with buttons and select menus for enhanced user experience
- ButtonHandler system (`utils/buttonHandler.js`) manages all interactive elements

### Database System (`utils/database.js`)
- File-based storage using JSON files in `/data` directory
- In-memory Map collections for performance
- Automatic data persistence and loading
- Supports users, shop items, companies, and lottery data
- Company data loaded from GitHub with existing members and funds

### Economy Features
- Virtual currency system with configurable currency name and emoji
- User statistics tracking (games played, won, total earned/spent)
- Daily rewards with streak bonuses
- Work system with random job scenarios and payouts (requires energy)
- Energy system: 100 max energy, 10 consumed per work, regenerates 1/5min
- Company system with create/join/leave functionality and job positions
- Inventory system for purchasable items with expiration dates
- Comprehensive profile system showing all user statistics and cooldowns

### Gaming Systems
- **Coinflip**: Simple heads/tails betting game
- **Slots**: Multi-reel slot machine with various winning combinations
- **Blackjack**: Full blackjack implementation with interactive buttons
- **Lottery**: Server-wide lottery system with scheduled drawings

### Shop System
- Configurable items with categories and pricing
- Support for permanent and temporary items
- Role-based purchases and special effects
- Admin-managed inventory

## Data Flow

1. **User Interaction**: Discord messages trigger command processing
2. **Command Processing**: Commands validate input and check permissions/cooldowns
3. **Database Operations**: User data is retrieved, modified, and persisted
4. **Response Generation**: Formatted embeds are sent back to Discord
5. **Background Tasks**: Lottery drawings and item expiration cleanup

## External Dependencies

### Core Dependencies
- **discord.js**: ^14.21.0 - Discord API wrapper for bot functionality

### GitHub Integration
- Optional GitHub API integration for data backup/restore
- Supports importing user data from external sources
- Requires GitHub token for authenticated requests

### Configuration
- Environment variable based configuration
- Support for bot token, prefixes, and GitHub credentials
- Configurable economy parameters (cooldowns, payouts, etc.)

## Deployment Strategy

### Environment Setup
- Requires Node.js runtime environment
- Environment variables for sensitive configuration
- File system access for data persistence

### Configuration Variables
- `DISCORD_TOKEN`: Bot authentication token
- `PREFIX`: Command prefix (default: "!")
- `GITHUB_REPO`: Repository for data sync (optional)
- `GITHUB_TOKEN`: GitHub authentication (optional)

### Data Persistence
- JSON files stored in `/data` directory
- Automatic backup capability through GitHub integration
- In-memory caching for performance optimization

### Logging System
- Comprehensive logging with timestamps
- Separate log files for different severity levels
- File-based log storage in `/logs` directory

### Scalability Considerations
- File-based storage suitable for small to medium servers
- In-memory caching reduces file I/O operations
- Modular command system allows easy feature expansion
- GitHub integration provides data portability and backup