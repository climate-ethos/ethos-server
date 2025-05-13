# Check if .env file exists
if [ ! -f .env ]; then
  echo ".env file not found! Please create a .env file in the root directory."
  exit 1
fi

docker compose --profile prod down

docker compose -p ethos-server --profile prod up --build -d