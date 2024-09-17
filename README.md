# ethos-server

This repository stores the setup information needed to run the server for the Ethos project.

## Endpoints

The root path ('/') redirects to couchdb running on port 5984 while the path ('/server') redirects to the node instance running on port 8080.

## Sending surveys to clients

Surveys can be sent to clients by running `curl -u user:password -d '{"newValue": true}' -H "Content-Type: application/json" -X POST http://example.org/server/displaySurvey` where user and password are the `USERNAME` and `PASSWORD` configured in `.env` and `example.org` is the domain name of the server

## Installation & running

### Prerequisites

This repo requires a pre-existing installation of docker to be configured, preferably in rootless mode. To install docker:

1. Run `curl -fsSL https://get.docker.com -o get-docker.sh` and then `sudo sh ./get-docker.sh`
2. Install packages to configure rootless docker `sudo apt-get install -y dbus-user-session uidmap systemd-container`
3. Add a new user to run docker with `adduser docker-user`
4. Disable existing running docker instance `sudo systemctl disable --now docker.service docker.socket` and `sudo rm /var/run/docker.sock`
5. Login with user created earlier using `sudo machinectl shell docker-user@`
6. Setup daemon with `dockerd-rootless-setuptool.sh install`
7. Start docker instance with `systemctl --user start docker.service`
8. Enable starting docker on system startup with `sudo loginctl enable-linger docker-user`

More information can be found [here](https://docs.docker.com/engine/security/rootless/)

### Running the server

1. Copy .env.example to .env (`cp .env.example .env`) and fill out all the fields (`nano .env`)
2. Configure `nginx/conf/nginx.conf` file with the correct domain name for your server
3. Start nginx with `docker compose up -d nginx`. If you get errors you may need to comment out the 2nd half of `nginx.conf` until you setup certbot
4. Setup certbot by running `docker compose run --rm  certbot certonly --webroot --webroot-path /var/www/certbot/ -d example.org` replacing example.org with your domain name
5. Run `sh dev_start_server.sh` or `sh prod_start_server.sh` depending on if you are in a production or dev environment
