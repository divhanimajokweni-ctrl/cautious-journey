FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV DASHBOARD_PORT=7860
ENV DASHBOARD_HOST=0.0.0.0

EXPOSE 7860

CMD ["node", "dashboard/server.js"]
