# Introduction

I wanted a way to let me and my friends interact with our own-self-hosted Project Zomboid game server . So I tinkered around and we got the idea to make a discord bot out of it

Works with Docker and systemd

Based on the docker server by @indifferentbroccoli: [https://github.com/indifferentbroccoli/projectzomboid-server-docker]

## Requirements
- Node (v20.6+ - to support --env-file in cli)
- Docker

## Installation

1. In the current project directory, copy the service files if not copied yet
```sh
sudo cp *.service /lib/systemd/system/
```

2. Edit both the service files

```sh
sudo cp *.service ./
sudo systemctl daemon-reload # load
sudo systemctl enable service
sudo systemctl start service
```

Restarting
```sh
sudo systemctl daemon-reload # load
sudo systemctl restart pz-server-api.service && sudo systemctl restart pz-discord-bot.service
```

Setting up env files
```
PORT
CONTAINER_NAME=projectzomboid
COMPOSE_FILE
RCON_PASSWORD
```

Expose backend/api port in firewall
