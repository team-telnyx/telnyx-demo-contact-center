'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Conversations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      conversation_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      from_number: {
        type: Sequelize.STRING(15),
        allowNull: true
      },
      to_number: {
        type: Sequelize.STRING(15),
        allowNull: true
      },
      agent_assigned: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      assigned: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      tag: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      last_message: {
        type: Sequelize.STRING(1024),
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index on conversation_id for faster lookups
    await queryInterface.addIndex('Conversations', ['conversation_id'], {
      unique: true,
      name: 'conversations_conversation_id_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Conversations');
  }
};
