FROM node:18-alpine

WORKDIR /usr/app

COPY package.json .

RUN npm install -g nodemon

RUN npm install --quiet

COPY . .