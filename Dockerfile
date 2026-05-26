FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /data

EXPOSE 8080

CMD ["npm", "start"]
