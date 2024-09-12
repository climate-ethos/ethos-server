module.exports = {
  apps: [
    {
      name: 'ethos-server-websocket',
      script: 'index.js', // The app's entry file
      instances: 1, // The number of instances to be run
      autorestart: true, // Automatically restart the app if it crashes
      watch: true, // Watch for file changes and restart the app when changes are detected
      max_memory_restart: '1G', // Restart the app if it reaches 1GB of memory
    },
  ],
};