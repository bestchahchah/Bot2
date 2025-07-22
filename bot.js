const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = "ODMxMzI2MTQwODAyMjY5MjA0.GbZRIJ.9fIk3MVLnVqn5Ta0puj2e-Tw41VfFZ7hy8RvbU";
const BALANCES_FILE = 'balances.json';
const BACKUP_FILE = 'balances_backup.json';
const PREFIX = '-';
const MERCHANT_NAME = 'Tucker';
const COMPANIES_FILE = 'companies.json';

const CHANGELOG = [
  'Added -balance, -leaderboard commands',
  'Switched to JavaScript version',
  'Added -changelog command',
  'Advanced data saver for balances and inventory',
  'Added jobs system (-applyjob, -work)',
  'Added merchant Tucker (-merchant)',
  'Added -profile command with improved formatting and emojis',
  'Added energy system and cooldown to -work',
  'Changed command prefix to -',
  'Sectioned command list in -help',
  'Added -help as alias for -cmds and -commands',
  'Bot status now shows -help',
  'Updated -work prompt to reference -applyjob',
];

const CHANGELOG_SECTIONS = [
  {
    title: '💰 Economy',
    entries: [
      'Added -balance, -leaderboard commands',
      'Advanced data saver for balances and inventory'
    ]
  },
  {
    title: '💼 Jobs',
    entries: [
      'Added jobs system (-applyjob, -work)',
      'Added energy system and cooldown to -work'
    ]
  },
  {
    title: '🛒 Merchant',
    entries: [
      'Added merchant Tucker (-merchant)'
    ]
  },
  {
    title: '👤 Profile',
    entries: [
      'Added -profile command with improved formatting and emojis'
    ]
  },
  {
    title: 'ℹ️ Info/General',
    entries: [
      'Switched to JavaScript version',
      'Added -changelog command',
      'Changed command prefix to -',
      'Sectioned command list in -help',
      'Added -help as alias for -cmds and -commands',
      'Bot status now shows -help',
      'Updated -work prompt to reference -applyjob'
    ]
  }
];

const COMMAND_SECTIONS = [
  {
    title: '💰 Economy',
    cmds: [
      { cmd: '-balance', desc: 'Check your current balance.' },
      { cmd: '-leaderboard', desc: 'Show the top 10 richest users.' }
    ]
  },
  {
    title: '💼 Jobs',
    cmds: [
      { cmd: '-applyjob', desc: 'See available jobs or apply for one.' },
      { cmd: '-work', desc: 'Work your job to earn your salary.' },
      { cmd: 'Energy', desc: 'Work uses energy. You recover 1 energy every 30 minutes. Max 100 energy. Each work costs 10 energy.' }
    ]
  },
  {
    title: '🛒 Merchant',
    cmds: [
      { cmd: '-merchant', desc: 'Talk to Tucker the merchant.' }
    ]
  },
  {
    title: '🏢 Companies',
    cmds: [
      { cmd: '-makecompany <name>', desc: 'Create your own company.' },
      { cmd: '-invite <@user>', desc: 'Invite a user to your company (owner only).' },
      { cmd: '-accept', desc: 'Accept a company invite.' },
      { cmd: '-leavecompany', desc: 'Leave your current company.' },
      { cmd: '-company [name]', desc: 'View a company profile.' },
      { cmd: '-companylb', desc: 'View the top companies by member wealth.' },
      { cmd: '-companydeposit <amount>', desc: 'Deposit money into your company funds.' },
      { cmd: '-companywithdraw <amount>', desc: 'Withdraw money from your company funds (owner only).' },
      { cmd: '-companyupgrades', desc: 'View company upgrades (coming soon).' }
    ]
  },
  {
    title: '👤 Profile',
    cmds: [
      { cmd: '-profile [@user]', desc: 'Show your or another user\'s profile.' }
    ]
  },
  {
    title: 'ℹ️ Info',
    cmds: [
      { cmd: '-changelog', desc: 'Show the latest bot changes.' },
      { cmd: '-cmds or -commands or -help', desc: 'Show this command list.' }
    ]
  },
  {
    title: '💰 Economy',
    cmds: [
      { cmd: '-setsalary <amount>', desc: 'Set your company job salary (owner only).' }
    ]
  }
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

function loadCompanies() {
  if (!fs.existsSync(COMPANIES_FILE)) return {};
  return JSON.parse(fs.readFileSync(COMPANIES_FILE));
}

function saveCompanies(companies) {
  fs.writeFileSync(COMPANIES_FILE, JSON.stringify(companies));
}

const JOBS = [
  { name: 'Cashier', salary: 150 },
  { name: 'Programmer', salary: 300 },
  { name: 'Artist', salary: 200 },
  { name: 'Chef', salary: 180 }
];

const MAX_ENERGY = 100;
const ENERGY_RECOVERY_MINUTES = 30; // 1 energy recovers every 30 minutes
const WORK_COOLDOWN_SECONDS = 60 * 10; // 10 minutes cooldown between works
const ENERGY_COST_PER_WORK = 10;
const COMPANY_COST = 100000;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('-help', { type: 'LISTENING' });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;
  let balances = loadBalances();

  // Ensure user data structure supports companyId
  if (!balances[userId]) {
    balances[userId] = { money: 0, inventory: [], job: null, energy: MAX_ENERGY, lastWork: 0, lastEnergy: Date.now(), companyId: null };
  } else {
    if (typeof balances[userId] === 'number') {
      balances[userId] = { money: balances[userId], inventory: [], job: null, energy: MAX_ENERGY, lastWork: 0, lastEnergy: Date.now(), companyId: null };
    }
    if (!('companyId' in balances[userId])) balances[userId].companyId = null;
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
    message.reply(`Your gummies balance is ${bal}.`);
  }

  if (command === 'applyjob') {
    if (args.length === 0) {
      let jobList = JOBS.map(j => `- ${j.name} (${j.salary}/work)`).join('\n');
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
      message.reply('You do not have a job. Use -applyjob to see available jobs.');
      return;
    }
    // Company job logic
    let companyJob = false;
    let companySalary = 500;
    let companies = loadCompanies();
    let userCompany = null;
    if (balances[userId].companyId && companies[balances[userId].companyId]) {
      userCompany = companies[balances[userId].companyId];
      if (userCompany.name.toLowerCase() === jobName.toLowerCase()) {
        companyJob = true;
        companySalary = userCompany.salary || 500;
      }
    }
    let job = JOBS.find(j => j.name === jobName);
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
    if (balances[userId].energy < ENERGY_COST_PER_WORK) {
      // Time until enough energy
      const needed = ENERGY_COST_PER_WORK - balances[userId].energy;
      const nextEnergyIn = msPerEnergy - (now - balances[userId].lastEnergy);
      const min = Math.ceil((needed * msPerEnergy - (now - balances[userId].lastEnergy)) / 60000);
      message.reply(`You need at least ${ENERGY_COST_PER_WORK} energy to work! You will have enough in ${min} minute(s).`);
      return;
    }
    balances[userId].energy -= ENERGY_COST_PER_WORK;
    balances[userId].lastWork = now;
    if (companyJob) {
      // Company pays salary if it has enough funds
      if (userCompany.funds < companySalary) {
        message.reply(`Your company does not have enough gummies to pay your salary (${companySalary} gummies).`);
        return;
      }
      userCompany.funds -= companySalary;
      balances[userId].money += companySalary;
      companies[balances[userId].companyId] = userCompany;
      saveCompanies(companies);
      saveBalances(balances);
      message.reply(`You worked for your company (${userCompany.name}) and earned ${companySalary} gummies! Your new gummies balance is ${balances[userId].money}. Energy left: ${balances[userId].energy}/${MAX_ENERGY}`);
      return;
    }
    // Default job logic
    if (!job) {
      message.reply('Your job is not recognized.');
      return;
    }
    balances[userId].money += job.salary;
    // Company profit sharing
    if (balances[userId].companyId) {
      const companies = loadCompanies();
      const cid = balances[userId].companyId;
      if (companies[cid]) {
        const companyShare = Math.floor(job.salary * 0.10);
        companies[cid].funds += companyShare;
        saveCompanies(companies);
      }
    }
    saveBalances(balances);
    message.reply(`You worked as a ${job.name} and earned ${job.salary} gummies! Your new gummies balance is ${balances[userId].money}. Energy left: ${balances[userId].energy}/${MAX_ENERGY}`);
  }

  if (command === 'makecompany') {
    if (balances[userId].companyId) {
      const companies = loadCompanies();
      const company = companies[balances[userId].companyId];
      message.reply('You already own or are a member of a company: ' + (company ? company.name : 'Unknown'));
      return;
    }
    if (args.length === 0) {
      message.reply('Please provide a name for your company. Usage: -makecompany <company name>');
      return;
    }
    if (balances[userId].money < COMPANY_COST) {
      message.reply(`You need at least ${COMPANY_COST.toLocaleString()} gummies to create a company.`);
      return;
    }
    const companyName = args.join(' ');
    const companies = loadCompanies();
    // Prevent duplicate company names
    const allCompanies = Object.values(companies).map(c => c.name.toLowerCase());
    if (allCompanies.includes(companyName.toLowerCase())) {
      message.reply('A company with that name already exists. Please choose another name.');
      return;
    }
    // Create company
    const companyId = Date.now().toString() + Math.floor(Math.random()*1000).toString();
    companies[companyId] = {
      name: companyName,
      owner: userId,
      members: [userId],
      funds: 0,
      invites: [],
      upgrades: []
    };
    balances[userId].companyId = companyId;
    balances[userId].money -= COMPANY_COST;
    saveBalances(balances);
    saveCompanies(companies);
    message.reply(`🎉 Company created! You are now the owner of "${companyName}". (${COMPANY_COST.toLocaleString()} gummies deducted)`);
  }

  if (command === 'leaderboard') {
    const OWNER_ID = '693528568612782201';
    const sorted = Object.entries(balances)
      .filter(([id, _]) => id !== OWNER_ID)
      .sort((a, b) => b[1].money - a[1].money);
    if (sorted.length === 0) {
      message.reply('No one has earned any gummies yet!');
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
      msg += `${i + 1}. ${user.username}: ${data.money} gummies\n`;
    }
    message.reply(msg);
  }

  if (command === 'merchant') {
    message.reply(`Greetings, traveler! I am ${MERCHANT_NAME}, the merchant. In the future, I'll have items for sale and buy your loot. Stay tuned for my shop!`);
  }

  if (command === 'changelog') {
    let changelog = `__**📜 Bot Changelog**__\n\n`;
    for (const section of CHANGELOG_SECTIONS) {
      changelog += `__${section.title}__\n`;
      changelog += section.entries.map(e => `• ${e}`).join('\n\n') + '\n\n';
    }
    message.reply(changelog.trim());
  }

  if (command === 'cmds' || command === 'commands' || command === 'help') {
    let msg = '**Available Commands:**\n';
    for (const section of COMMAND_SECTIONS) {
      msg += `\n**${section.title}**\n`;
      for (const c of section.cmds) {
        msg += `  ${c.cmd} — ${c.desc}\n`;
      }
    }
    message.reply(msg.trim());
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
    let companyName = 'None';
    let companyMembers = 0;
    let companyFunds = 0;
    if (userData.companyId) {
      const companies = loadCompanies();
      if (companies[userData.companyId]) {
        companyName = companies[userData.companyId].name;
        companyMembers = companies[userData.companyId].members.length;
        companyFunds = companies[userData.companyId].funds;
      }
    }
    let isOwner = target.id === '693528568612782201' || target.username.toLowerCase() === 'bestchinoforever';
    let ownerBadge = isOwner ? ' 👑 (Owner)' : '';
    let profileMsg = `__**👤 ${target.username}${ownerBadge}'s Profile**__\n\n🍬 **Gummies:** ${userData.money}\n💼 **Job:** ${job}\n\n🏢 **Company:** ${companyName}${companyName !== 'None' ? `\n   👥 Members: ${companyMembers}\n   🍬 Funds: ${companyFunds}` : ''}\n\n🎒 **Inventory:** ${inv}\n⚡ **Energy:** ${userData.energy}/${MAX_ENERGY}`;
    message.reply(profileMsg);
  }

  if (command === 'invite') {
    const companies = loadCompanies();
    const userCompanyId = balances[userId].companyId;
    if (!userCompanyId || !companies[userCompanyId] || companies[userCompanyId].owner !== userId) {
      message.reply('You must be the owner of a company to invite members.');
      return;
    }
    const mention = message.mentions.users.first();
    if (!mention) {
      message.reply('Please mention a user to invite.');
      return;
    }
    const targetId = mention.id;
    if (balances[targetId] && balances[targetId].companyId) {
      message.reply('That user is already in a company.');
      return;
    }
    if (companies[userCompanyId].invites.includes(targetId)) {
      message.reply('That user has already been invited.');
      return;
    }
    companies[userCompanyId].invites.push(targetId);
    saveCompanies(companies);
    message.reply(`Invite sent to ${mention.username}. They can use -accept to join your company.`);
  }

  if (command === 'accept') {
    const companies = loadCompanies();
    if (balances[userId].companyId) {
      message.reply('You are already in a company.');
      return;
    }
    let found = null;
    for (const [cid, c] of Object.entries(companies)) {
      if (c.invites.includes(userId)) {
        found = cid;
        break;
      }
    }
    if (!found) {
      message.reply('You have no pending company invites.');
      return;
    }
    companies[found].members.push(userId);
    companies[found].invites = companies[found].invites.filter(i => i !== userId);
    balances[userId].companyId = found;
    saveBalances(balances);
    saveCompanies(companies);
    message.reply(`You have joined the company: ${companies[found].name}`);
  }

  if (command === 'leavecompany') {
    const companies = loadCompanies();
    const cid = balances[userId].companyId;
    if (!cid || !companies[cid]) {
      message.reply('You are not in a company.');
      return;
    }
    if (companies[cid].owner === userId) {
      // Owner leaving: disband company
      for (const member of companies[cid].members) {
        if (balances[member]) balances[member].companyId = null;
      }
      delete companies[cid];
      saveBalances(balances);
      saveCompanies(companies);
      message.reply('You were the owner. Company disbanded.');
      return;
    }
    // Member leaving
    companies[cid].members = companies[cid].members.filter(m => m !== userId);
    balances[userId].companyId = null;
    saveBalances(balances);
    saveCompanies(companies);
    message.reply('You have left your company.');
  }

  if (command === 'company') {
    const companies = loadCompanies();
    let targetCompany = null;
    if (args.length === 0 && balances[userId].companyId) {
      targetCompany = companies[balances[userId].companyId];
    } else if (args.length > 0) {
      const name = args.join(' ').toLowerCase();
      targetCompany = Object.values(companies).find(c => c.name.toLowerCase() === name);
    }
    if (!targetCompany) {
      message.reply('Company not found.');
      return;
    }
    let ownerName = 'Unknown';
    try {
      const ownerUser = await client.users.fetch(targetCompany.owner);
      ownerName = ownerUser.username;
    } catch {}
    let memberNames = [];
    for (const m of targetCompany.members) {
      try {
        const u = await client.users.fetch(m);
        memberNames.push(u.username);
      } catch {
        memberNames.push('Unknown');
      }
    }
    let funds = targetCompany.funds || 0;
    let upgrades = targetCompany.upgrades && targetCompany.upgrades.length > 0 ? targetCompany.upgrades.join(', ') : 'None';
    let msg = `__**🏢 Company: ${targetCompany.name}**__\n\n👑 Owner: ${ownerName}\n👥 Members (${memberNames.length}): ${memberNames.join(', ')}\n🍬 Gummies: ${funds}\n🔧 Upgrades: ${upgrades}`;
    message.reply(msg);
  }

  if (command === 'companylb') {
    const companies = loadCompanies();
    // Sort by total member wealth
    const leaderboard = Object.entries(companies).map(([cid, c]) => {
      let total = 0;
      for (const m of c.members) {
        if (balances[m]) total += balances[m].money;
      }
      return { name: c.name, total, members: c.members.length };
    }).sort((a, b) => b.total - a.total).slice(0, 10);
    if (leaderboard.length === 0) {
      message.reply('No companies found.');
      return;
    }
    let msg = '**🏢 Company Leaderboard:**\n';
    leaderboard.forEach((c, i) => {
      msg += `${i+1}. ${c.name} — ${c.total} gummies (${c.members} members)\n`;
    });
    message.reply(msg);
  }

  if (command === 'companydeposit') {
    const companies = loadCompanies();
    const cid = balances[userId].companyId;
    if (!cid || !companies[cid]) {
      message.reply('You are not in a company.');
      return;
    }
    let amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      message.reply('Please specify a valid amount to deposit.');
      return;
    }
    if (balances[userId].money < amount) {
      message.reply('You do not have enough money.');
      return;
    }
    balances[userId].money -= amount;
    companies[cid].funds += amount;
    saveBalances(balances);
    saveCompanies(companies);
    message.reply(`Deposited ${amount} gummies to your company funds.`);
  }

  if (command === 'companywithdraw') {
    const companies = loadCompanies();
    const cid = balances[userId].companyId;
    if (!cid || !companies[cid]) {
      message.reply('You are not in a company.');
      return;
    }
    if (companies[cid].owner !== userId) {
      message.reply('Only the company owner can withdraw funds.');
      return;
    }
    let amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      message.reply('Please specify a valid amount to withdraw.');
      return;
    }
    if (companies[cid].funds < amount) {
      message.reply('Company does not have enough funds.');
      return;
    }
    companies[cid].funds -= amount;
    balances[userId].money += amount;
    saveBalances(balances);
    saveCompanies(companies);
    message.reply(`Withdrew ${amount} gummies from your company funds.`);
  }

  if (command === 'companyupgrades') {
    message.reply('Company upgrades coming soon!');
  }

  if (command === 'setsalary') {
    const companies = loadCompanies();
    const cid = balances[userId].companyId;
    if (!cid || !companies[cid]) {
      message.reply('You are not in a company.');
      return;
    }
    if (companies[cid].owner !== userId) {
      message.reply('Only the company owner can set the salary.');
      return;
    }
    let amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      message.reply('Please specify a valid salary amount.');
      return;
    }
    companies[cid].salary = amount;
    saveCompanies(companies);
    message.reply(`Company job salary set to ${amount} gummies.`);
  }
});

client.login(TOKEN);