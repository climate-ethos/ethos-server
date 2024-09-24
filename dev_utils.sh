# Import environment variables from .env file
export $(cat .env | xargs)

# Function to wait for CouchDB to start
wait_for_couchdb() {
    for _ in {1..15}; do # Try for 15 seconds
        if curl -s -u $COUCHDB_ADMIN_USER:$COUCHDB_ADMIN_PASSWORD http://localhost:5984/ >/dev/null; then
            return 0
        fi
        sleep 1
    done
    echo "CouchDB did not start in time"
    exit 1
}

# Create test user on DB
create_test_user() {
    curl -X PUT http://localhost:5984/_users/org.couchdb.user:999 \
         -H "Accept: application/json" \
         -H "Content-Type: application/json" \
         -u $COUCHDB_ADMIN_USER:$COUCHDB_ADMIN_PASSWORD \
         -d '{"name": "999", "password": "12345", "roles": [], "type": "user"}'
}
