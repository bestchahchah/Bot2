const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const TOKEN = "ODMxMzI2MTQwODAyMjY5MjA0.Gt6hmz.L4I-UtsC5FHbHUgpunRUR14S_zLLaXdQsJOalA";
const BALANCES_FILE = 'balances.json';
const PREFIX = '!';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

function loadBalances() {
  if (!fs.existsSync(BALANCES_FILE)) return {};
  return JSON.parse(fs.readFileSync(BALANCES_FILE));
}

function saveBalances(balances) {
  fs.writeFileSync(BALANCES_FILE, JSON.stringify(balances));
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

  if (command === 'balance') {
    const bal = balances[userId] || 0;
    message.reply(`Your balance is $${bal}.`);
  }

  if (command === 'earn') {
    const earned = 100; // You can randomize this
    balances[userId] = (balances[userId] || 0) + earned;
    saveBalances(balances);
    message.reply(`You earned $${earned}! Your new balance is $${balances[userId]}.`);
  }

  if (command === 'leaderboard') {
    const sorted = Object.entries(balances).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      message.reply('No one has earned any money yet!');
      return;
    }
    let msg = '**Leaderboard:**\n';
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const [id, bal] = sorted[i];
      let user;
      try {
        user = await client.users.fetch(id);
      } catch {
        user = { username: 'Unknown' };
      }
      msg += `${i + 1}. ${user.username}: $${bal}\n`;
    }
    message.reply(msg);
  }

  if (command === 'changelog') {
    const changelog = `**Changelog:**\n- Added !balance, !earn, !leaderboard commands\n- Switched to JavaScript version\n- Added !changelog command`;
    message.reply(changelog);
  }
});

client.login(TOKEN);