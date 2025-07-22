import discord
from discord.ext import commands
import json
import os

TOKEN = "ODMxMzI2MTQwODAyMjY5MjA0.Gt6hmz.L4I-UtsC5FHbHUgpunRUR14S_zLLaXdQsJOalA"
BALANCES_FILE = "balances.json"

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

def load_balances():
    if not os.path.exists(BALANCES_FILE):
        return {}
    with open(BALANCES_FILE, "r") as f:
        return json.load(f)

def save_balances(balances):
    with open(BALANCES_FILE, "w") as f:
        json.dump(balances, f)

@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")

@bot.command()
async def balance(ctx):
    balances = load_balances()
    user_id = str(ctx.author.id)
    bal = balances.get(user_id, 0)
    await ctx.send(f"{ctx.author.mention}, your balance is ${bal}.")

@bot.command()
async def earn(ctx):
    balances = load_balances()
    user_id = str(ctx.author.id)
    earned = 100  # You can randomize this or make it more complex
    balances[user_id] = balances.get(user_id, 0) + earned
    save_balances(balances)
    await ctx.send(f"{ctx.author.mention}, you earned ${earned}! Your new balance is ${balances[user_id]}.")

@bot.command()
async def leaderboard(ctx):
    balances = load_balances()
    if not balances:
        await ctx.send("No one has earned any money yet!")
        return
    sorted_bal = sorted(balances.items(), key=lambda x: x[1], reverse=True)
    msg = "**Leaderboard:**\n"
    for i, (user_id, bal) in enumerate(sorted_bal[:10], 1):
        user = await bot.fetch_user(int(user_id))
        msg += f"{i}. {user.name}: ${bal}\n"
    await ctx.send(msg)

bot.run(TOKEN)