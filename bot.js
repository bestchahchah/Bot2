const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = "ODMxMzI2MTQwODAyMjY5MjA0.Gt6hmz.L4I-UtsC5FHbHUgpunRUR14S_zLLaXdQsJOalA";
const BALANCES_FILE = 'balances.json';
const BACKUP_FILE = 'balances_backup.json';
const PREFIX = '!';
const MERCHANT_NAME = 'Tucker';

const CHANGELOG = [
  'Added !balance, !earn, !leaderboard commands',
  'Switched to JavaScript version',
  'Added !changelog command',
  'Advanced data saver for balances and inventory',
  'Added jobs system (!applyjob, !work)',
  'Added merchant Tucker (!merchant)'
];

const COMMANDS_LIST = [
  { cmd: '!balance', desc: 'Check your current balance.' },
  { cmd: '!leaderboard', desc: 'Show the top 10 richest users.' },
  { cmd: '!applyjob', desc: 'See available jobs or apply for one.' },
  { cmd: '!work', desc: 'Work your job to earn your salary.' },
  { cmd: '!merchant', desc: 'Talk to Tucker the merchant.' },
  { cmd: '!changelog', desc: 'Show the latest bot changes.' },
  { cmd: '!cmds or !commands', desc: 'Show this command list.' },
  { cmd: '!profile [@user]', desc: 'Show your or another user\'s profile.' },
  { cmd: 'Energy', desc: 'Work uses energy. You recover 1 energy every 30 minutes. Max 5 energy.' }
];

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

const JOBS = [
  { name: 'Cashier', salary: 150 },
  { name: 'Programmer', salary: 300 },
  { name: 'Artist', salary: 200 },
  { name: 'Chef', salary: 180 }
];

const MAX_ENERGY = 5;
const ENERGY_RECOVERY_MINUTES = 30; // 1 energy recovers every 30 minutes
const WORK_COOLDOWN_SECONDS = 60 * 10; // 10 minutes cooldown between works

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;
  let balances = loadBalances();

  // Ensure user data structure supports future inventory, job, energy, and lastWork
  if (!balances[userId]) {
    balances[userId] = { money: 0, inventory: [], job: null, energy: MAX_ENERGY, lastWork: 0, lastEnergy: Date.now() };
  } else {
    if (typeof balances[userId] === 'number') {
      balances[userId] = { money: balances[userId], inventory: [], job: null, energy: MAX_ENERGY, lastWork: 0, lastEnergy: Date.now() };
    }
    if (!('inventory' in balances[userId])) balances[userId].inventory = [];
    if (!('job' in balances[userId])) balances[userId].job = null;
    if (!('energy' in balances[userId])) balances[userId].energy = MAX_ENERGY;
    if (!('lastWork' in balances[userId])) balances[userId].lastWork = 0;
    if (!('lastEnergy' in balances[userId])) balances[userId].lastEnergy = Date.now();
  }

  // Energy recovery logic
  const now = Date.now();
  const msPerEnergy = ENERGY_RECOVERY_MINUTES * 60 * 1000;
  let energyToRecover = Math.floor((now - balances[userId].lastEnergy) / msPerEnergy);
  if (energyToRecover > 0) {
    balances[userId].energy = Math.min(MAX_ENERGY, balances[userId].energy + energyToRecover);
    balances[userId].lastEnergy += energyToRecover * msPerEnergy;
    saveBalances(balances);
  }

  if (command === 'balance') {
    const bal = balances[userId].money;
    message.reply(`Your balance is $${bal}.`);
  }

  if (command === 'applyjob') {
    if (args.length === 0) {
      let jobList = JOBS.map(j => `- ${j.name} ($${j.salary}/work)`).join('\n');
      message.reply(`Available jobs:\n${jobList}\nUse !applyjob <jobname> to apply.`);
      return;
    }
    const jobName = args.join(' ').toLowerCase();
    const job = JOBS.find(j => j.name.toLowerCase() === jobName);
    if (!job) {
      message.reply('Job not found. Use !applyjob to see available jobs.');
      return;
    }
    balances[userId].job = job.name;
    saveBalances(balances);
    message.reply(`You have successfully applied for the job: ${job.name}. Use !work to earn your salary!`);
  }

  if (command === 'work') {
    const jobName = balances[userId].job;
    if (!jobName) {
      message.reply('You do not have a job. Use !applyjob to see available jobs.');
      return;
    }
    const job = JOBS.find(j => j.name === jobName);
    if (!job) {
      message.reply('Your job is no longer available. Please apply for a new job.');
      balances[userId].job = null;
      saveBalances(balances);
      return;
    }
    // Cooldown check
    const lastWork = balances[userId].lastWork || 0;
    const now = Date.now();
    const secondsSinceLastWork = Math.floor((now - lastWork) / 1000);
    if (secondsSinceLastWork < WORK_COOLDOWN_SECONDS) {
      const timeLeft = WORK_COOLDOWN_SECONDS - secondsSinceLastWork;
      const min = Math.floor(timeLeft / 60);
      const sec = timeLeft % 60;
      message.reply(`You are tired! You can work again in ${min}m ${sec}s.`);
      return;
    }
    // Energy check
    if (balances[userId].energy <= 0) {
      // Time until next energy
      const nextEnergyIn = msPerEnergy - (now - balances[userId].lastEnergy);
      const min = Math.ceil(nextEnergyIn / 60000);
      message.reply(`You are out of energy! You will recover 1 energy in ${min} minute(s).`);
      return;
    }
    balances[userId].energy -= 1;
    balances[userId].lastWork = now;
    balances[userId].money += job.salary;
    saveBalances(balances);
    message.reply(`You worked as a ${job.name} and earned $${job.salary}! Your new balance is $${balances[userId].money}. Energy left: ${balances[userId].energy}/${MAX_ENERGY}`);
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

  if (command === 'merchant') {
    message.reply(`Greetings, traveler! I am ${MERCHANT_NAME}, the merchant. In the future, I'll have items for sale and buy your loot. Stay tuned for my shop!`);
  }

  if (command === 'changelog') {
    const changelog = `**Changelog:**\n- ${CHANGELOG.join('\n- ')}`;
    message.reply(changelog);
  }

  if (command === 'cmds' || command === 'commands') {
    let msg = '**Available Commands:**\n';
    for (const c of COMMANDS_LIST) {
      msg += `${c.cmd} — ${c.desc}\n`;
    }
    message.reply(msg);
  }

  if (command === 'profile') {
    let target = message.mentions.users.first() || message.author;
    let targetId = target.id;
    let userData = balances[targetId];
    if (!userData) {
      message.reply(`${target.username} does not have a profile yet.`);
      return;
    }
    let job = userData.job ? userData.job : 'None';
    let inv = userData.inventory && userData.inventory.length > 0 ? userData.inventory.join(', ') : 'Empty';
    let profileMsg = `**Profile for ${target.username}:**\nBalance: $${userData.money}\nJob: ${job}\nInventory: ${inv}`;
    message.reply(profileMsg);
  }
});

client.login(TOKEN);