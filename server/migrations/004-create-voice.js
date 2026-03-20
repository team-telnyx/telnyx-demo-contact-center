'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Voices', {
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      queue_uuid: {
        type: Sequelize.STRING,
        allowNull: true
      },
      telnyx_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      destination_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      direction: {
        type: Sequelize.STRING,
        allowNull: true
      },
      queue_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      accept_agent: {
        type: Sequelize.STRING,
        allowNull: true
      },
      transfer_agent: {
        type: Sequelize.STRING,
        allowNull: true
      },
      bridge_uuid: {
        type: Sequelize.STRING,
        allowNull: true
      },
      conference_id: {
        type: Sequelize.STRING,
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Voices');
  }
};
