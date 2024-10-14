# Import utility functions
source dev_utils.sh

# Path to your CSV file
CSV_FILE="users.csv"

# Read the CSV file, skipping the header
tail -n +2 "$CSV_FILE" | while IFS=',' read -r username password; do
    # Call the function for each username and password
    create_couchdb_user "$username" "$password"
done
