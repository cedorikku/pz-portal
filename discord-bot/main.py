import discord
import os
import requests
import logging
from discord.ext import commands
from discord import app_commands
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')
BASE_URL = os.getenv('BASE_URL')

if BASE_URL and not BASE_URL.startswith(('http://', 'https://')):
    BASE_URL = f"http://{BASE_URL}"

handler = logging.FileHandler(filename="discord.log", encoding="utf-8", mode='w')
intents = discord.Intents.default()

class ServerManager(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def api_request(self, method: str, endpoint: str):
        """Helper to perform the request and return the response object."""
        url = f"{BASE_URL.rstrip('/')}/{endpoint}"
        try:
            if method == "POST":
                return requests.post(url, timeout=10)
            return requests.get(url, timeout=10)
        except requests.exceptions.RequestException as e:
            logging.error(f"API Request failed: {e}")
            return None

    @app_commands.command(name="pz_start", description="Power on the server")
    async def start_server(self, interaction: discord.Interaction):
        await interaction.response.defer()
        response = await self.api_request("POST", "start")
        
        if response is None:
            await interaction.followup.send("❌ Connection Error: Backend is unalive :<")
            return

        if response.status_code == 200:
            await interaction.followup.send("🚀 **Zomboid Server started**")
        elif response.status_code == 400:
            await interaction.followup.send("ℹ️ **Zomboid Server already started**")
        elif response.status_code == 500:
            await interaction.followup.send("🔥 **Backend is not working as intended**")
        else:
            await interaction.followup.send(f"Unexpected status: {response.status_code}")

    @app_commands.command(name="pz_stop", description="Power off the server")
    async def stop_server(self, interaction: discord.Interaction):
        await interaction.response.defer()
        response = await self.api_request("POST", "stop")
        
        if response is None:
            await interaction.followup.send("❌ Connection Error: Backend is unreachable.")
            return

        if response.status_code == 200:
            await interaction.followup.send("🛑 **Zomboid Server stopped successfully**")
        elif response.status_code == 400:
            await interaction.followup.send("⚠️ **Zomboid Server already down**")
        elif response.status_code == 500:
            await interaction.followup.send("🔥 **Backend is not working as intended**")
        else:
            await interaction.followup.send(f"Unexpected status: {response.status_code}")

    @app_commands.command(name="pz_status", description="Check server status")
    async def check_server(self, interaction: discord.Interaction):
        await interaction.response.defer()
        response = await self.api_request("GET", "status")
        
        if response is None:
            await interaction.followup.send("❌ Connection Error: Backend is unreachable.")
            return

        if response.status_code == 200:
            await interaction.followup.send("🟢 **Server is online**")
        elif response.status_code == 400:
            await interaction.followup.send("🔴 **Server is down**")
        elif response.status_code == 500:
            await interaction.followup.send("🔥 **Backend is not working as intended**")
        else:
            await interaction.followup.send(f"Unexpected status: {response.status_code}")

class MyBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix="!", intents=intents)
    
    async def setup_hook(self):
        await self.add_cog(ServerManager(self))
        await self.tree.sync()
        print("Slash commands synced.")

bot = MyBot()

if __name__ == "__main__":
    bot.run(TOKEN, log_handler=handler, log_level=logging.DEBUG)