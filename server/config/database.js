// database.js
require('dotenv').config({path:'../.env'});
const { Sequelize } = require('sequelize');

// Use SQLite for development, MySQL for production
const sequelize = process.env.NODE_ENV === 'production' 
  ? new Sequelize({
      host: process.env.DB_HOST,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      dialect: 'mysql',
      logging: false
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: './database.sqlite',
      logging: false
    });

// Test connection
sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// Create tables if they don't exist (removed auto-sync from config)
// Tables will be synced when server starts

module.exports = sequelize;
