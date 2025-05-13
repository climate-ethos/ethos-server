# ethos-server

This repository stores the setup information needed to run the server for the Ethos project.
The system uses Nginx for SSL termination and as a reverse proxy, with Certbot for automatic SSL certificate renewal.

## NGINX Endpoints

The root path (`/`) redirects to CouchDB running on port 5984.
The path (`/server/`) redirects to the Node.js instance (internally on HTTP port 8080).

## Sending surveys to clients

Surveys can be sent to clients by running:
`curl -u user:password -d '{"newValue": true}' -H "Content-Type: application/json" -X POST https://fish-vital.bnr.la/server/displayBomSurvey`
(Replace `user:password` with your `USERNAME` and `PASSWORD` from `.env`, and `fish-vital.bnr.la` with your actual domain if different).

## Installation & running

### Prerequisites

1. **Docker:** This repo requires a pre-existing installation of Docker. Rootless mode is recommended.
    * Install Docker: `curl -fsSL https://get.docker.com -o get-docker.sh` and then `sudo sh ./get-docker.sh`.
    * For rootless Docker (refer to official Docker docs for the most up-to-date instructions):
        1. Install prerequisites: `sudo apt-get update && sudo apt-get install -y dbus-user-session uidmap systemd-container fuse-overlayfs`
        2. Allow low-port binding for rootless user (e.g., for ports 80, 443): Add `net.ipv4.ip_unprivileged_port_start=80` to `/etc/sysctl.conf` then run `sudo sysctl -p`.
        3. Create a dedicated user: `sudo adduser docker-user`
        4. Disable system-wide Docker: `sudo systemctl disable --now docker.service docker.socket`, `sudo rm -f /var/run/docker.sock`.
        5. Log in as the `docker-user`: `sudo machinectl shell docker-user@` (or `su - docker-user`).
        6. Install rootless Docker: `dockerd-rootless-setuptool.sh install`.
        7. Start user Docker service: `systemctl --user start docker`.
        8. Enable linger for the user: `sudo loginctl enable-linger docker-user`.
        More information: [Docker Rootless Mode Docs](https://docs.docker.com/engine/security/rootless/)

2. **Node.js Server Configuration:** Ensure your Node.js application (the `server` service) is configured to listen on **HTTP port 8080**. It should not attempt to handle HTTPS itself.

### One-Time SSL Setup (for Nginx)

1. **Generate DH Parameters:** This strengthens SSL. It can take a few minutes.

    ```bash
    openssl dhparam -out ./certbot/conf/ssl-dhparams.pem 2048
    ```

2. **Configure SSL Options File (`./nginx/ssl_common/options-ssl-nginx.conf`):**
    Use a strong configuration. You can generate one from the [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/). Select Nginx, your server version, and "Modern" compatibility.
    Example content for `./nginx/ssl_common/options-ssl-nginx.conf`:

    ```nginx
    # Modern configuration, tweak as necessary
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ```

### Running the server

1. **(If running docker rootless)** Login to your `docker-user` account: `sudo machinectl shell docker-user@`
2. Clone this repository.
3. Navigate into the cloned directory.
4. Copy `.env.example` to `.env` (`cp .env.example .env`) and fill out all the fields (`nano .env`).
    * Ensure `COUCHDB_ADMIN_USER`, `COUCHDB_ADMIN_PASSWORD`, `REDIS_PASSWORD`, `USERNAME`, `PASSWORD` etc. are set.
5. Configure `./nginx/conf/nginx.conf` with your correct domain name (`fish-vital.bnr.la` and `www.fish-vital.bnr.la` should already be set).
6. **Initial Certificate Generation (First Time Only):**
    * Start Nginx temporarily to serve the ACME challenge:

        ```bash
        docker compose --profile prod up -d nginx
        ```

    * Run Certbot to obtain certificates. Replace `your-email@example.com` with your actual email and verify domain names:

        ```bash
        docker compose --profile prod run --rm certbot certonly \
          --webroot \
          --webroot-path /var/www/certbot/ \
          -d fish-vital.bnr.la -d www.fish-vital.bnr.la \
          --email your-email@example.com \
          --agree-tos --no-eff-email \
          --force-renewal # Use --force-renewal only if re-running for existing domains and need to force it
        ```

    * If successful, Nginx (which is already running) should now have the certs. You can stop it and restart all services, or just proceed.

        ```bash
        # Optional: docker compose --profile prod stop nginx
        ```

7. **Start all services (including Nginx with certs, and Certbot for auto-renewal):**
    The `prod_start_server.sh` or `dev_start_server.sh` scripts can handle starting services for you.
    Alternatively a general command for production:

    ```bash
    docker compose --profile prod up -d
    ```

### Configuring CouchDB users

1. Copy `users.csv.example` to `users.csv` and populate the file with usernames and passwords.
2. Run `sh prod_create_users_from_csv.sh` to create CouchDB users and views. This script likely runs a command like `docker compose exec couchdb ...` or similar.

## API Endpoints

### Authentication

All endpoints marked with `[AUTH]` require authentication using the `authMiddleware`.

All endpoints marked with `[AUTHDB]` require authentication against the couchdb database. The authenticated user's identity must match the `identity` or `userId` provided in the request body for applicable endpoints.

### Survey Display

#### Get BOM Survey Display Status

* **URL:** `/displayBomSurvey`
* **Method:** GET
* **Description:** Retrieves the current status of whether to display a BOM survey.
* **Response:**

  ```json
  {
    "displaySurvey": boolean
  }
  ```

#### Update BOM Survey Display Status [AUTH]

* **URL:** `/displayBomSurvey`
* **Method:** POST
* **Description:** Updates the BOM survey display status.
* **Body:**

  ```json
  {
    "newValue": boolean
  }
  ```

* **Response:** String confirming the update.

#### Get User BOM Survey Display Status [AUTHDB]

* **URL:** `/displayUserHeatSurvey`
* **Method:** GET
* **Description:** Retrieves the current status of whether to display a BOM survey for given user passed in credentials.
* **Response:**

  ```json
  {
    "displaySurvey": boolean
  }
  ```

#### Update User BOM Survey Display Status [AUTHDB]

* **URL:** `/displayUserHeatSurvey`
* **Method:** POST
* **Description:** Updates the BOM survey display status of current user passed in credentials.
* **Body:**

  ```json
  {
    "newValue": boolean
  }
  ```

* **Response:** String confirming the update.

#### Get User Heat Survey Display Status [AUTHDB]

* **URL:** `/displayUserHeatSurvey`
* **Method:** GET
* **Description:** Retrieves the current status of whether to display a Heat Alert survey for given user passed in credentials.
* **Response:**

  ```json
  {
    "displaySurvey": boolean
  }
  ```

#### Update User Heat Survey Display Status [AUTHDB]

* **URL:** `/displayUserHeatSurvey`
* **Method:** POST
* **Description:** Updates the Heat Alert survey display status of current user passed in credentials.
* **Body:**

  ```json
  {
    "newValue": boolean
  }
  ```

* **Response:** String confirming the update.

### Device Registration

#### Register Device [AUTHDB]

* **URL:** `/registerDevice`
* **Method:** POST
* **Description:** Registers a device for push notifications. If device is undefined, it will default to iOS. Set tag as 'research_participant' for those users who will be receiving surveys.
* **Body:**

  ```json
  {
    "identity": string,
    "address": string,
    "tag": "research_participant" | undefined,
    "device": "android" | "ios" | undefined
  }
  ```

* **Response:** String confirming registration.

#### Remove Device [AUTHDB]

* **URL:** `/removeDevice`
* **Method:** POST
* **Description:** Removes a device for push notifications.
* **Body:**

  ```json
  {
    "identity": string,
    "address": string,
  }
  ```

* **Response:** String confirming removal.

### Push Notifications

#### Send Alert Push Notification [AUTHDB]

* **URL:** `/sendAlertPushNotification`
* **Method:** POST
* **Description:** Sends a heat alert push notification to a registered device.
* **Body:**

  ```json
  {
    "identity": string,
    "roomName": string,
    "severity": "medium" | "high"
  }
  ```

* **Response:** String confirming the notification was sent.

#### Send Survey Push Notification [AUTHDB]

* **URL:** `/sendSurveyPushNotification`
* **Method:** POST
* **Description:** Sends a survey push notification to a registered device.
* **Body:**

  ```json
  {
    "identity": string,
    "surveyType": "alert" | "bom" | "both"
  }
  ```

* **Response:** String confirming the notification was sent.

### SMS Notifications

#### Send SMS Notification [AUTHDB]

* **URL:** `/sendSMSNotification`
* **Method:** POST
* **Description:** Sends an SMS notification.
* **Body:**

  ```json
  {
    "userId": string | number,
    "phoneNumber": string,
    "roomName": string,
    "severity": "medium" | "high"
  }
  ```

* **Response:** String confirming the SMS was sent.

### Notes

* All authenticated routes require a valid authentication token to be included in the request header.
* For endpoints that require an `identity` or `userId` in the request body, this `identity` must match the authenticated user's identity.
* Error responses will include appropriate HTTP status codes and error messages.
* The `sendPushNotification` and `sendSMS` functions are available for use within the application but are not directly exposed as API endpoints.
