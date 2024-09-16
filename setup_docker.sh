#!/bin/bash

# Ensure the script is not being run as root for rootless Docker
if [ "$EUID" -eq 0 ]; then
  echo "This script should not be run as root to enable rootless Docker."

  # Optionally, create a new non-root user for Docker setup
  read -p "Do you want to create a new non-root user for Docker setup? [y/n]: " create_user
  if [[ "$create_user" == "y" ]]; then
    read -p "Enter new username: " username
    adduser $username
    usermod -aG sudo $username
    echo "User $username created. Please log in as $username to run the script."
    exit 1
  else
    echo "Exiting script. Please run as a non-root user."
    exit 1
  fi
fi

# Install Docker using the convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

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

# Print instructions to enable rootless mode (in case of additional configuration)
echo "Docker rootless mode installed. You may need to restart your session for changes to take effect."

# Optionally, start Docker rootless service manually if not already running
systemctl --user start docker

# Check Docker installation and version
docker version
