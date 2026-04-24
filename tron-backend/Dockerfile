# Use a lightweight Node image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies first (for caching)
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your API runs on
EXPOSE 3000

# Tell the container exactly what to run when it boots
CMD ["node", "src/index.js"]