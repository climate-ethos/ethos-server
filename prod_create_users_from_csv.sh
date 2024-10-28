#!/bin/bash  # Explicitly use bash instead of sh

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Create user on DB using passed username and password
create_couchdb_user() {
    local username=$1
    local password=$2
    curl -X PUT http://localhost:5984/_users/org.couchdb.user:$username \
         -H "Accept: application/json" \
         -H "Content-Type: application/json" \
         -u $COUCHDB_ADMIN_USER:$COUCHDB_ADMIN_PASSWORD \
         -d "{\"name\": \"$username\", \"password\": \"$password\", \"roles\": [], \"type\": \"user\"}"
}

# Path to your CSV file
CSV_FILE="users.csv"

while IFS=, read -r username password || [ -n "$username" ]; do
    if [ "$username" != "username" ]; then  # Skip header row
        echo "Adding user: $username"
        create_couchdb_user "$username" "$password"
    fi
done < "$CSV_FILE"