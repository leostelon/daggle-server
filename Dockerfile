# Nodejs App
FROM node:16.11.1 as node

COPY package.json /app/
COPY src /app/src/

WORKDIR /app

EXPOSE 3000

RUN mkdir -p /app/uploads
RUN npm install

FROM node:16.11.1-alpine3.14
RUN apk --no-cache add curl
RUN apk add --no-cache bash
RUN apk add --no-cache openssl

WORKDIR /app

EXPOSE 3000

COPY --from=node /app/ /app/
RUN npm install

RUN curl -sL https://get.bacalhau.org/install.sh | bash

CMD [ "node", "src/index.js" ]