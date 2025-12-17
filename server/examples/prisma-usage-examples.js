/**
 * Prisma Usage Examples for Cloudflare D1
 *
 * This file shows how to use Prisma in your Express routes
 * with Cloudflare Workers and D1
 */

const { getPrismaClient } = require('../lib/prisma');

/**
 * Example: User CRUD operations
 */
async function userExamples(env) {
  const prisma = getPrismaClient(env.DB);

  // Create a user
  const newUser = await prisma.user.create({
    data: {
      firstName: 'John',
      lastName: 'Doe',
      username: 'johndoe',
      password: 'hashed_password_here',
      sipUsername: 'john_sip',
      sipPassword: 'sip_pass',
      phoneNumber: '+15551234567',
      status: 1
    }
  });

  // Find user by username
  const user = await prisma.user.findUnique({
    where: {
      username: 'johndoe'
    }
  });

  // Find user by ID
  const userById = await prisma.user.findUnique({
    where: {
      id: 1
    }
  });

  // Find all users
  const allUsers = await prisma.user.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Update user
  const updatedUser = await prisma.user.update({
    where: {
      id: 1
    },
    data: {
      status: 1,
      phoneNumber: '+15559876543'
    }
  });

  // Delete user
  const deletedUser = await prisma.user.delete({
    where: {
      id: 1
    }
  });

  // Count users
  const userCount = await prisma.user.count();

  // Find users with filters
  const activeUsers = await prisma.user.findMany({
    where: {
      status: 1
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      status: true
    }
  });
}

/**
 * Example: Conversation with Messages (Relations)
 */
async function conversationExamples(env) {
  const prisma = getPrismaClient(env.DB);

  // Create conversation
  const conversation = await prisma.conversation.create({
    data: {
      conversation_id: 'conv_123',
      from_number: '+15551111111',
      to_number: '+15552222222',
      assigned: false
    }
  });

  // Create message in conversation
  const message = await prisma.message.create({
    data: {
      direction: 'inbound',
      type: 'sms',
      telnyx_number: '+15552222222',
      destination_number: '+15551111111',
      text_body: 'Hello, I need help!',
      conversation_id: 'conv_123'
    }
  });

  // Get conversation with all messages
  const conversationWithMessages = await prisma.conversation.findUnique({
    where: {
      conversation_id: 'conv_123'
    },
    include: {
      messages: {
        orderBy: {
          createdAt: 'asc'
        }
      }
    }
  });

  // Update conversation
  const updatedConversation = await prisma.conversation.update({
    where: {
      conversation_id: 'conv_123'
    },
    data: {
      assigned: true,
      agent_assigned: 'agent_john',
      last_message: 'Hello, I need help!',
      last_read_at: new Date()
    }
  });

  // Get all conversations for an agent
  const agentConversations = await prisma.conversation.findMany({
    where: {
      agent_assigned: 'agent_john'
    },
    include: {
      messages: {
        take: 1,
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  // Count unread conversations
  const unreadCount = await prisma.conversation.count({
    where: {
      agent_assigned: 'agent_john',
      last_read_at: {
        lt: new Date() // Messages after last read
      }
    }
  });
}

/**
 * Example: Call Session with Call Legs (Relations)
 */
async function callSessionExamples(env) {
  const prisma = getPrismaClient(env.DB);

  // Create call session
  const session = await prisma.callSession.create({
    data: {
      sessionKey: 'session_abc123',
      direction: 'inbound',
      from_number: '+15551111111',
      to_number: '+15552222222',
      status: 'queued',
      started_at: new Date()
    }
  });

  // Create call leg
  const leg = await prisma.callLeg.create({
    data: {
      call_control_id: 'cc_123',
      sessionKey: 'session_abc123',
      leg_type: 'inbound',
      direction: 'inbound',
      status: 'new',
      start_time: new Date()
    }
  });

  // Get session with all legs
  const sessionWithLegs = await prisma.callSession.findUnique({
    where: {
      sessionKey: 'session_abc123'
    },
    include: {
      callLegs: {
        orderBy: {
          createdAt: 'asc'
        }
      }
    }
  });

  // Update call leg
  const updatedLeg = await prisma.callLeg.update({
    where: {
      call_control_id: 'cc_123'
    },
    data: {
      status: 'answered',
      accepted_by: 'agent_john'
    }
  });

  // End call session
  const endedSession = await prisma.callSession.update({
    where: {
      sessionKey: 'session_abc123'
    },
    data: {
      status: 'completed',
      ended_at: new Date()
    }
  });
}

/**
 * Example: Queue (Voice) operations
 */
async function voiceQueueExamples(env) {
  const prisma = getPrismaClient(env.DB);

  // Add call to queue
  const queueEntry = await prisma.voice.create({
    data: {
      uuid: crypto.randomUUID(),
      direction: 'inbound',
      telnyx_number: '+15552222222',
      destination_number: '+15551111111',
      queue_name: 'support',
      status: 'queued'
    }
  });

  // Get all queued calls
  const queuedCalls = await prisma.voice.findMany({
    where: {
      status: 'queued'
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  // Assign call to agent
  const assignedCall = await prisma.voice.update({
    where: {
      uuid: queueEntry.uuid
    },
    data: {
      status: 'assigned',
      accept_agent: 'agent_john'
    }
  });

  // Complete call
  const completedCall = await prisma.voice.update({
    where: {
      uuid: queueEntry.uuid
    },
    data: {
      status: 'completed'
    }
  });

  // Get queue stats
  const queueStats = await prisma.voice.groupBy({
    by: ['status'],
    _count: {
      status: true
    }
  });
}

/**
 * Example: Transaction (atomic operations)
 */
async function transactionExample(env) {
  const prisma = getPrismaClient(env.DB);

  // Use transaction for multiple related operations
  const result = await prisma.$transaction(async (tx) => {
    // Create conversation
    const conversation = await tx.conversation.create({
      data: {
        conversation_id: 'conv_456',
        from_number: '+15551111111',
        to_number: '+15552222222',
        assigned: true,
        agent_assigned: 'agent_john'
      }
    });

    // Create initial message
    const message = await tx.message.create({
      data: {
        direction: 'inbound',
        type: 'sms',
        telnyx_number: '+15552222222',
        destination_number: '+15551111111',
        text_body: 'Starting conversation',
        conversation_id: conversation.conversation_id
      }
    });

    // Update user status
    const user = await tx.user.update({
      where: {
        username: 'agent_john'
      },
      data: {
        status: 1 // Active
      }
    });

    return { conversation, message, user };
  });

  return result;
}

/**
 * Example: Raw SQL queries (for complex queries)
 */
async function rawSqlExample(env) {
  const prisma = getPrismaClient(env.DB);

  // Raw query
  const users = await prisma.$queryRaw`
    SELECT * FROM Users WHERE status = 1
  `;

  // Raw query with parameters
  const username = 'johndoe';
  const user = await prisma.$queryRaw`
    SELECT * FROM Users WHERE username = ${username}
  `;

  // Execute raw SQL (for INSERT/UPDATE/DELETE)
  const result = await prisma.$executeRaw`
    UPDATE Users SET status = 0 WHERE lastLoginAt < datetime('now', '-30 days')
  `;

  return { users, user, result };
}

module.exports = {
  userExamples,
  conversationExamples,
  callSessionExamples,
  voiceQueueExamples,
  transactionExample,
  rawSqlExample
};
