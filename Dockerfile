# syntax=docker/dockerfile:1
FROM node:18-alpine AS base

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install --production

# Copy source
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]



