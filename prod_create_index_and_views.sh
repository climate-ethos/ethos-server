#!/bin/bash  # Explicitly use bash instead of sh

# Load environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Function to convert username to hexadecimal
username_to_hex() {
    local username=$1
    echo -n "$username" | xxd -p | tr -d '\n'  # Converts to hex without newlines
}

# Create views for user for historical sensor data
create_couchdb_views_for_user() {
    local username=$1
    local username_hex
    username_hex=$(username_to_hex "$username")

    echo "User: $username_hex"

    # Check if the design document already exists
    if curl -s --head http://localhost:5984/userdb-${username_hex}/_design/sensor_view | grep "200 OK" > /dev/null; then
        echo "View for user '$username' already exists. Skipping creation."
        return
    fi

    # Create view
     curl -X PUT http://localhost:5984/userdb-${username_hex}/_design/sensor_view \
         -H "Accept: application/json" \
         -H "Content-Type: application/json" \
         -u $COUCHDB_ADMIN_USER:$COUCHDB_ADMIN_PASSWORD \
         -d '{
             "views": {
                 "daily_aggregates": {
                     "map": "function (doc) { if (doc.type === '\''sensor'\'' && doc.time) { var dateKey = doc.time.split('\''T'\'')[0]; emit(dateKey, { humidity: doc.humidity, coreTemperatureDelta: doc.coreTemperatureDelta, temperature: doc.temperature }); } }",
                     "reduce": "function (keys, values, rereduce) { var result = { count: 0, humiditySum: 0, coreTempDeltaSum: 0, minTemp: null, maxTemp: null }; values.forEach(function (value) { if (rereduce) { result.count += value.count; result.humiditySum += value.humiditySum; result.coreTempDeltaSum += value.coreTempDeltaSum; result.minTemp = Math.min(result.minTemp, value.minTemp); result.maxTemp = Math.max(result.maxTemp, value.maxTemp); } else { result.count += 1; if (value.humidity !== undefined) { result.humiditySum += value.humidity; } if (value.coreTemperatureDelta !== undefined) { result.coreTempDeltaSum += value.coreTemperatureDelta; } if (value.temperature !== undefined) { if (result.minTemp === null || value.temperature < result.minTemp) { result.minTemp = value.temperature; } if (result.maxTemp === null || value.temperature > result.maxTemp) { result.maxTemp = value.temperature; } } } }); return result; }"
                 }
             }
         }'
}

# Create index for type and time-based queries
create_couchdb_index_for_user() {
    local username=$1
    local username_hex
    username_hex=$(username_to_hex "$username")

    echo "Creating index for user: $username_hex"

    curl -X POST http://localhost:5984/userdb-${username_hex}/_index \
         -H "Accept: application/json" \
         -H "Content-Type: application/json" \
         -u $COUCHDB_ADMIN_USER:$COUCHDB_ADMIN_PASSWORD \
         -d '{
             "index": {
                 "fields": [
                     {"type": "desc"},
                     {"time": "desc"}
                 ]
             },
             "name": "type-time-index",
             "type": "json"
         }'
}

# Path to your CSV file
CSV_FILE="users.csv"

while IFS=, read -r username password || [ -n "$username" ]; do
    if [ "$username" != "username" ]; then  # Skip header row
		echo "Creating index for user: $username"
        create_couchdb_index_for_user "$username"
        echo "NOT Creating views for user: $username"
        # create_couchdb_views_for_user "$username"
    fi
done < "$CSV_FILE"