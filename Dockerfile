FROM node:20-alpine as developement


WORKDIR /usr/src/app

COPY package*.json .

RUN npm install
COPY . .

RUN npm run start



FROM node:20-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app
COPY package*.json .

RUN npm ci --only=production

COPY --from=developement /usr/src/app/build ./build


CMD ["node", "build/app.js"]