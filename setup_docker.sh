#!/bin/bash

# Function to check if a user exists
user_exists() {
  id "$1" &>/dev/null
}

# Ensure the script is not being run as root for rootless Docker
if [ "$EUID" -eq 0 ]; then
  echo "Running as root. Checking if 'docker-user' exists..."

  # Load environment variables from .env file
  if [ -f .env ]; then
    export $(cat .env | xargs)
  else
    echo ".env file not found! Please create one with DOCKER_USER_PASSWORD."
    exit 1
  fi

  # Check if 'docker-user' exists, if not, create it
  if ! user_exists "docker-user"; then
    echo "Creating 'docker-user' user..."

    # Create the user with the password read from .env file
    encrypted_password=$(openssl passwd -1 "$DOCKER_USER_PASSWORD")
    useradd -m -p "$encrypted_password" docker-user
    usermod -aG sudo docker-user
    echo "'docker-user' user created and added to sudo group."
  else
    echo "'docker-user' user already exists."
  fi

  # Switch to 'docker-user' and re-run the script
  echo "Switching to 'docker-user' user..."
  sudo -i -u docker-user bash << EOF
export DOCKER_USER_PASSWORD="$DOCKER_USER_PASSWORD"
$(cat "$0")
EOF
  exit 0
fi

# If we're here, we're running as docker-user
echo "Running as docker-user. Proceeding with Docker installation..."

# Install Docker using the convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add the current user to the Docker group (if needed)
sudo usermod -aG docker $USER

# Install required dependencies for rootless Docker mode
sudo apt-get update
sudo apt-get install -y \
    uidmap \
    dbus-user-session \
    slirp4netns

# Enable rootless mode for Docker
dockerd-rootless-setuptool.sh install

# Update environment variables for rootless Docker mode
echo "export PATH=/usr/bin:$PATH" >> ~/.bashrc
echo "export DOCKER_HOST=unix:///run/user/$UID/docker.sock" >> ~/.bashrc

# Apply the changes
source ~/.bashrc

# Optionally, start Docker rootless service manually if not already running
systemctl --user start docker

# Check Docker installation and version
docker version