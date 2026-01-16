import discord
import os
import aiohttp
import asyncio
import requests
import logging
from discord.ext import commands
from discord import app_commands
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv('DISCORD_TOKEN')
BASE_URL = os.getenv('BASE_URL')

if (TOKEN is None):
    raise ValueError("DISCORD_TOKEN environment variable is not set.")

if (BASE_URL is None):
    raise ValueError("BASE_URL environment variable is not set.")
elif not BASE_URL.startswith(('http://', 'https://')):
    raise ValueError("BASE_URL environment variable does not have http protocol set.")

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

        if response.status_code == 204:
            await interaction.followup.send("🚀 **Zomboid Server started**")
        elif response.status_code == 409:
            await interaction.followup.send("ℹ️ **Zomboid Server already started**")
        elif response.status_code == 500:
            await interaction.followup.send(f"🔥 **Backend Error:** {response.json().error}")
        else:
            await interaction.followup.send(f"Unexpected status: {response.status_code}")

    @app_commands.command(name="pz_stop", description="Power off the server")
    async def stop_server(self, interaction: discord.Interaction):
        await interaction.response.defer()
        response = await self.api_request("POST", "stop")
        
        if response is None:
            await interaction.followup.send("❌ Connection Error: Backend is unreachable.")
            return

        if response.status_code == 204:
            await interaction.followup.send("🛑 **Zomboid Server stopped successfully**")
        elif response.status_code == 409:
            await interaction.followup.send("⚠️ **Zomboid Server already down**")
        elif response.status_code == 500:
            await interaction.followup.send(f"🔥 **Backend Error:** {response.json().error}")
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
            # Clean the response body and check the text content
            result = response.text.strip().lower()

            match result:
                case "starting":
                    await interaction.followup.send("🟡 **Server is STARTING**")
                case "healthy":
                    await interaction.followup.send("🟢 **Server is UP**")
                case "inactive":
                    await interaction.followup.send("🟠 **Server is OFFLINE**")
                case "failed":
                    await interaction.followup.send("🔴 **Server FAILED TO START**")
                case _:
                    await interaction.followup.send(
                        f"❓ Received 200, but unknown body: `{result}`"
                    )
        else:
            await interaction.followup.send(f"Unexpected status: {response.status_code}")

    @app_commands.command(name="pz_players", description="Lists all current players in server")
    async def list_players(self, interaction: discord.Interaction):
        await interaction.response.defer()
        response = await self.api_request("GET", "players")

        if response is None:
            await interaction.followup.send("❌ Connection Error: Backend is unreachable.")
            return

        match response.status_code:
            case 200:
                try:
                    result = response.json()
                except ValueError:
                    await interaction.followup.send("Received non-JSON response")
                    return

                if (not isinstance(result, list) or len(result) == 0):
                    await interaction.followup.send("🥶 No Players Online")

                message = f"Players Online: {len(result)}"
                message += ("```")

                for name in result:
                    message += f"\n- {name}"

                message += ("```")
                await interaction.followup.send(message)
            case 409:
                await interaction.followup.send("⚠️ **Zomboid Server isn't online**")
            case 500: 
                await interaction.followup.send(f"🔥 **Backend Error:** {response.json().error}")
            case _:
                await interaction.followup.send(f"Unexpected status: {response.status_code}")


class MyBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix="!", intents=intents)
        self.sse_task: asyncio.Task[None] | None = None
    
    async def setup_hook(self):
        await self.add_cog(ServerManager(self))
        await self.tree.sync()

        self.sse_task = asyncio.create_task(self.listen_to_sse())

        print("Slash commands synced.")

    async def listen_to_sse(self):
        url = f"{BASE_URL.rstrip('/')}/presence"
        delay = 5

        while True:
            try: 
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url, 
                        timeout=None, 
                        headers={"Accept": "text/event-stream"}
                    ) as resp:
                        if resp.status != 200:
                            logging.error(f"SSE connection failed with status: {resp.status}")
                            raise RuntimeError("Failed to connect to /presence endpoint.")

                        async for raw_line in resp.content:
                            line = raw_line.decode("utf-8").strip()

                            if not line or not line.startswith("data:"):
                                continue

                            data = line.removeprefix("data:").strip()

                            await self.update_presence_from_sse(data)

            except Exception as e:
                logging.error(f"SSE connection dropped: {e}")
                await asyncio.sleep(delay)

    async def update_presence_from_sse(self, data: str):
        """
        current possible data from sse could be:
        - starting
        - healthy {player_count}: int
        - inactive
        - failed
        """

        match data:
            case "starting":
                activity = discord.Game(name="🟡 Server Spinning up")
                status = discord.Status.online
            case s if s.startswith("healthy"):
                player_count = int(s.removeprefix("healthy "))
                activity_name = "Server Online" if player_count == 0 else f"Server Online ({player_count} online)"
                activity = discord.Game(name=f"🟢 {activity_name}")
                status = discord.Status.online
            case "inactive":
                activity = discord.Game(name="🟠 Server Offline")
                status = discord.Status.idle
            case "failed":
                activity = discord.Game(name="🔴 Server Failed (check logs)")
                status = discord.Status.dnd
            case _:
                activity = discord.Game(name="⁉️")
                status = discord.Status.idle

        await self.change_presence(status=status, activity=activity)


bot = MyBot()

if __name__ == "__main__":
    bot.run(TOKEN, log_handler=handler, log_level=logging.DEBUG)
