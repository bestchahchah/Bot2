const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = "ODMxMzI2MTQwODAyMjY5MjA0.Gt6hmz.L4I-UtsC5FHbHUgpunRUR14S_zLLaXdQsJOalA";
const BALANCES_FILE = 'balances.json';
const BACKUP_FILE = 'balances_backup.json';
const PREFIX = '!';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

function atomicWrite(file, data) {
  const tempFile = file + '.tmp';
  fs.writeFileSync(tempFile, data);
  fs.renameSync(tempFile, file);
}

function loadBalances() {
  if (!fs.existsSync(BALANCES_FILE)) {
    if (fs.existsSync(BACKUP_FILE)) {
      // Try to recover from backup
      fs.copyFileSync(BACKUP_FILE, BALANCES_FILE);
      return JSON.parse(fs.readFileSync(BALANCES_FILE));
    }
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(BALANCES_FILE));
  } catch (e) {
    // Try to recover from backup if main file is corrupted
    if (fs.existsSync(BACKUP_FILE)) {
      fs.copyFileSync(BACKUP_FILE, BALANCES_FILE);
      return JSON.parse(fs.readFileSync(BALANCES_FILE));
    }
    return {};
  }
}

function saveBalances(balances) {
  const data = JSON.stringify(balances);
  // Write to backup first
  atomicWrite(BACKUP_FILE, data);
  // Then write to main file
  atomicWrite(BALANCES_FILE, data);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;
  let balances = loadBalances();

  // Ensure user data structure supports future inventory
  if (!balances[userId]) {
    balances[userId] = { money: 0, inventory: [] };
  } else if (typeof balances[userId] === 'number') {
    // Migrate old format
    balances[userId] = { money: balances[userId], inventory: [] };
  }

  if (command === 'balance') {
    const bal = balances[userId].money;
    message.reply(`Your balance is $${bal}.`);
  }

  if (command === 'earn') {
    const earned = 100; // You can randomize this
    balances[userId].money += earned;
    saveBalances(balances);
    message.reply(`You earned $${earned}! Your new balance is $${balances[userId].money}.`);
  }

  if (command === 'leaderboard') {
    const sorted = Object.entries(balances).sort((a, b) => b[1].money - a[1].money);
    if (sorted.length === 0) {
      message.reply('No one has earned any money yet!');
      return;
    }
    let msg = '**Leaderboard:**\n';
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const [id, data] = sorted[i];
      let user;
      try {
        user = await client.users.fetch(id);
      } catch {
        user = { username: 'Unknown' };
      }
      msg += `${i + 1}. ${user.username}: $${data.money}\n`;
    }
    message.reply(msg);
  }

  if (command === 'changelog') {
    const changelog = `**Changelog:**\n- Added !balance, !earn, !leaderboard commands\n- Switched to JavaScript version\n- Added !changelog command\n- Advanced data saver for balances and inventory`;
    message.reply(changelog);
  }
});

client.login(TOKEN);