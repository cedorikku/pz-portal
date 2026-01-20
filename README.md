# Introduction

I wanted a way to let me and my friends interact with our own-self-hosted Project Zomboid game server. So I tinkered around and we got the idea to make a discord bot out of it.

Based on the Zomboid docker server by [@indifferentbroccoli](https://github.com/indifferentbroccoli/projectzomboid-server-docker)

## Requirements

> [!Note]
> This was tested on the Ubuntu 24.04 (noble)

- Node (v20.6+)
  - to support `--env-file` flag in cli
- pnpm
  - possible to work with npm or yarn, though not configured to
- Docker
- systemd
- Discord Application [https://discord.com/developers/applications]
  - given enough permission

## Usage

### API

If the [server's](https://github.com/indifferentbroccoli/projectzomboid-server-docker) up, it should work with just the API running and accessing the following endpoints:

```
GET /status
GET /players
GET /start/status
POST /start
POST /stop
```

### Discord Bot

This bot depends on the API running. Commands available:

```
/pz_start
/pz_stop
/pz_status
/pz_players
```

## Installation

### Setup

1. In the project directory, run the build script to generate /dist files

```sh
pnpm install --dir ./backend
pnpm run --dir ./backend build
```

2. Edit Discord Bot .env files, and input a Discord application key

```sh
cp ./discord-bot/.env.example ./discord-bot/.env
nano ./discord-bot/.env
```

3. Link the service files as soft links

```sh
sudo systemctl link *.service /etc/systemd/system/
```

4. Edit both the service files with hardcoded absolute values (replace inside the angled brackets _\<replace-me\>_):

Server API service

- `WorkingDirectory=<project-directory>`
  - Run `pwd`
- `Environment=COMPOSE_FILE=<file>`
  - Your zomboid game server's file absolute path
- `Environment=RCON_PASSWORD=<your-password>`
  - Should be the same password from your game server's remote control
- `User=<user>`
  - Run `whoami`, but if undetermined, just make sure it's not ROOT
- `ExecStart=<your-node-install-in-bin> backend/dist/index.js`
  - Run `which node`

```sh
nano pz-server-api.service
```

Discord Bot service

- `WorkingDirectory=<project-directory>`
  - Run `pwd`
- `User=<user>`
  - Run `whoami`, but if undetermined, just make sure it's not ROOT

```sh
nano pz-discord-bot.service
```

5. Configure systemd to recognize your service and start it on boot automatically

```sh
sudo systemctl daemon-reload
sudo systemctl enable pz-server-api.service && sudo systemctl enable pz-discord-bot.service
sudo systemctl start pz-server-api.service && sudo systemctl start pz-discord-bot.service
```

6. Restarting your service

> [!Note]
> Perform this whenever your files changes (incl. service files). You can restart only the service that was affected

```sh
sudo systemctl daemon-reload
sudo systemctl restart pz-server-api.service
sudo systemctl restart pz-discord-bot.service
```
