FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "src/server.js"]
