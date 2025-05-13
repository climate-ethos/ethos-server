# Clear existing build
docker compose down

# Import utility functions
source dev_utils.sh

# Check if .env file exists
if [ ! -f .env ]; then
  echo ".env file not found! Please create a .env file in the root directory."
  exit 1
fi

# Start server/docker
NODE_ENV=dev docker compose -p ethos-server up --build & # non blocking

# Setup couchdb
# Wait for couchdb to start
echo "WAITING FOR COUCHDB TO START"
wait_for_couchdb
# Create example user (id: 999)
echo "CREATING TEST USER"
create_test_user
