#!/bin/bash

# Exit on error
set -e

# Update system and install passt
sudo apt update
sudo apt install -y passt

# Create necessary directories
mkdir -p ~/.config/systemd/user/docker.service.d

# Create and populate the override.conf file with pasta configuration
cat > ~/.config/systemd/user/docker.service.d/override.conf << 'EOF'
[Service]
Environment="DOCKERD_ROOTLESS_ROOTLESSKIT_NET=pasta"
Environment="DOCKERD_ROOTLESS_ROOTLESSKIT_PORT_DRIVER=implicit"
EOF

# Reload systemd daemon and restart Docker service
echo "Reloading systemd daemon..."
systemctl --user daemon-reload

echo "Restarting Docker service..."
systemctl --user restart docker

echo "Docker has been configured to use pasta network driver"