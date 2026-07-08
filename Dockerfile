FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY index.js ./

ENV PORT=8000
ENV PRODUCT_COUNT=200

EXPOSE 8000

CMD ["npm", "start"]

