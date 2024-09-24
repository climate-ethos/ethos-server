# ethos-server

This repository stores the setup information needed to run the server for the Ethos project.

## NGINX Endpoints

The root path ('/') redirects to couchdb running on port 5984 while the path ('/server') redirects to the node instance running on port 8080.

## Sending surveys to clients

Surveys can be sent to clients by running `curl -u user:password -d '{"newValue": true}' -H "Content-Type: application/json" -X POST http://example.org/server/displaySurvey` where user and password are the `USERNAME` and `PASSWORD` configured in `.env` and `example.org` is the domain name of the server

## Installation & running

### Prerequisites

This repo requires a pre-existing installation of docker to be configured, preferably in rootless mode. To install docker:

1. Run `curl -fsSL https://get.docker.com -o get-docker.sh` and then `sudo sh ./get-docker.sh`
2. Install packages to configure rootless docker `sudo apt-get install -y dbus-user-session uidmap systemd-container`
3. Add a new user to run docker with `adduser docker-user`
4. Disable existing running docker instance `sudo systemctl disable --now docker.service docker.socket` and `sudo rm /var/run/docker.sock`
5. Login with user created earlier using `sudo machinectl shell docker-user@`
6. Setup daemon with `dockerd-rootless-setuptool.sh install`
7. Start docker instance with `systemctl --user start docker.service`
8. Enable starting docker on system startup with `sudo loginctl enable-linger docker-user`

More information can be found [here](https://docs.docker.com/engine/security/rootless/)

### Running the server

1. Copy .env.example to .env (`cp .env.example .env`) and fill out all the fields (`nano .env`)
2. Configure `nginx/conf/nginx.conf` file with the correct domain name for your server
3. Start nginx with `docker compose up -d nginx`. If you get errors you may need to comment out the 2nd half of `nginx.conf` until you setup certbot
4. Setup certbot by running `docker compose run --rm  certbot certonly --webroot --webroot-path /var/www/certbot/ -d example.org` replacing example.org with your domain name
5. Run `sh dev_start_server.sh` or `sh prod_start_server.sh` depending on if you are in a production or dev environment

## API Endpoints

### Authentication

All endpoints marked with `[AUTH]` require authentication using the `authMiddleware`.

All endpoints marked with `[AUTHDB]` require authentication against the couchdb database. The authenticated user's identity must match the `identity` or `userId` provided in the request body for applicable endpoints.

### Survey Display

#### Get Survey Display Status

- **URL:** `/displaySurvey`
- **Method:** GET
- **Description:** Retrieves the current status of survey display.
- **Response:**

  ```json
  {
    "displaySurvey": boolean
  }
  ```

#### Update Survey Display Status [AUTH]

- **URL:** `/displaySurvey`
- **Method:** POST
- **Description:** Updates the survey display status.
- **Body:**

  ```json
  {
    "newValue": boolean
  }
  ```

- **Response:** String confirming the update.

### Device Registration

#### Register Device [AUTHDB]

- **URL:** `/registerDevice`
- **Method:** POST
- **Description:** Registers a device for push notifications. If device is undefined, it will default to iOS. Set tag as 'research_participant' for those users who will be receiving surveys.
- **Body:**

  ```json
  {
    "identity": string,
    "address": string,
    "tag": "research_participant" | undefined,
    "device": "android" | "ios" | undefined
  }
  ```

- **Response:** String confirming registration.

#### Remove Device [AUTHDB]

- **URL:** `/removeDevice`
- **Method:** POST
- **Description:** Removes a device for push notifications.
- **Body:**

  ```json
  {
    "identity": string,
    "address": string,
  }
  ```

- **Response:** String confirming removal.

### Push Notifications

#### Send Alert Push Notification [AUTHDB]

- **URL:** `/sendAlertPushNotification`
- **Method:** POST
- **Description:** Sends a heat alert push notification to a registered device.
- **Body:**

  ```json
  {
    "identity": string,
    "roomName": string,
    "severity": "medium" | "high"
  }
  ```

- **Response:** String confirming the notification was sent.

#### Send Survey Push Notification [AUTHDB]

- **URL:** `/sendSurveyPushNotification`
- **Method:** POST
- **Description:** Sends a survey push notification to a registered device.
- **Body:**

  ```json
  {
    "identity": string,
    "surveyType": "alert" | "bom" | "both"
  }
  ```

- **Response:** String confirming the notification was sent.

### SMS Notifications

#### Send SMS Notification [AUTHDB]

- **URL:** `/sendSMSNotification`
- **Method:** POST
- **Description:** Sends an SMS notification.
- **Body:**

  ```json
  {
    "userId": string | number,
    "phoneNumber": string,
    "roomName": string,
    "severity": "medium" | "high"
  }
  ```

- **Response:** String confirming the SMS was sent.

### Notes

- All authenticated routes require a valid authentication token to be included in the request header.
- For endpoints that require an `identity` or `userId` in the request body, this `identity` must match the authenticated user's identity.
- Error responses will include appropriate HTTP status codes and error messages.
- The `sendPushNotification` and `sendSMS` functions are available for use within the application but are not directly exposed as API endpoints.
