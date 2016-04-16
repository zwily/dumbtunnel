FROM node:5.10

COPY package.json ./
RUN npm install

COPY *.js ./

CMD node frontend.js
