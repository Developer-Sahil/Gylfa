FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

# Start the react development server
CMD ["npm", "start"]
