// database.js
require('dotenv').config({path:'../.env'});
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dialect: 'mysql',
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

// Create tables if they don't exist
sequelize.sync({ alter: true }) // Set alter:true to update the table if it already exists
  .then(() => {
    console.log('Tables have been synchronized.');
  })
  .catch(err => {
    console.error('Error syncing tables:', err);
  });

module.exports = sequelize;
