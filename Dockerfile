FROM node:alpine3.20 AS base 

WORKDIR /app 

COPY package*.json ./

RUN npm ci 

COPY main.ts tsconfig.json ./

RUN npm run build

FROM node:alpine3.20 

RUN apk add --no-cache tini 

WORKDIR /vault 

COPY --from=base /app/main.js ./

COPY package*.json ./ 

RUN npm ci --only=production 

RUN addgroup -S vaultgroup && adduser -S vaultuser -G vaultgroup

RUN chown -R vaultuser:vaultgroup /vault 

USER vaultuser

ENTRYPOINT [ "/sbin/tini", "--", "node", "/vault/main.js" ]

CMD ["help"]
