'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Messages', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      direction: {
        type: Sequelize.STRING,
        allowNull: false
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      telnyx_number: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      destination_number: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      text_body: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      media: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tag: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      conversation_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Conversations',
          key: 'conversation_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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

    // Add index on conversation_id for faster joins
    await queryInterface.addIndex('Messages', ['conversation_id'], {
      name: 'messages_conversation_id_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Messages');
  }
};
