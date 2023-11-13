const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database'); // Make sure this path is correct

class Voice extends Model {}

Voice.init({
  // Define the schema here
  uuid: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  direction: {
    type: DataTypes.STRING,
    allowNull: true
  },
  telnyx_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  destination_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  queue_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  accept_agent: {
    type: DataTypes.STRING,
    allowNull: true // Assuming that this can be null
  },
  transfer_agent: {
    type: DataTypes.STRING,
    allowNull: true 
  },
  bridge_uuid: {
    type: DataTypes.STRING,
    allowNull: true
  },
  queue_uuid: {
    type: DataTypes.STRING,
    allowNull: true
  },
  conference_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
}, {
  // Other model options go here
  sequelize, // We need to pass the connection instance
  modelName: 'Voice', // We need to choose the model name
});

// If you don't have a table created, you can use this to create it based on your model
// Voice.sync({ force: true }); // This will forcefully create the table and drop it first if it already exists

module.exports = Voice;
