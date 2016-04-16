FROM node:5.10

COPY *.js ./
COPY package.json ./

RUN npm install

CMD node frontend.js
