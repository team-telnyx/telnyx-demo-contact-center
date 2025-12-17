/**
 * D1 Database Adapter
 * Provides a simplified interface to Cloudflare D1 database
 * Replaces Sequelize ORM with D1-specific queries
 */

class D1Adapter {
  constructor(d1Database) {
    this.db = d1Database;
  }

  /**
   * Execute a raw SQL query
   */
  async query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
      return result;
    } catch (error) {
      console.error('D1 query error:', error);
      throw error;
    }
  }

  /**
   * Execute a query and return first result
   */
  async queryOne(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).first() : await stmt.first();
      return result;
    } catch (error) {
      console.error('D1 queryOne error:', error);
      throw error;
    }
  }

  /**
   * Execute an insert/update/delete query
   */
  async execute(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = params.length > 0 ? await stmt.bind(...params).run() : await stmt.run();
      return result;
    } catch (error) {
      console.error('D1 execute error:', error);
      throw error;
    }
  }

  /**
   * Users table methods
   */
  async createUser(userData) {
    const sql = `
      INSERT INTO Users (firstName, lastName, phoneNumber, username, password, sipUsername, sipPassword, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await this.execute(sql, [
      userData.firstName,
      userData.lastName,
      userData.phoneNumber,
      userData.username,
      userData.password,
      userData.sipUsername,
      userData.sipPassword,
      userData.status || 0,
    ]);
    return { id: result.meta.last_row_id, ...userData };
  }

  async findUserByUsername(username) {
    const sql = `SELECT * FROM Users WHERE username = ?`;
    return await this.queryOne(sql, [username]);
  }

  async findUserById(id) {
    const sql = `SELECT * FROM Users WHERE id = ?`;
    return await this.queryOne(sql, [id]);
  }

  async updateUser(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const sql = `UPDATE Users SET ${setClause}, updatedAt = datetime('now') WHERE id = ?`;
    await this.execute(sql, [...values, id]);
    return await this.findUserById(id);
  }

  async getAllUsers() {
    const sql = `SELECT * FROM Users ORDER BY createdAt DESC`;
    const result = await this.query(sql);
    return result.results || [];
  }

  /**
   * Call Sessions methods
   */
  async createCallSession(sessionData) {
    const sql = `
      INSERT INTO call_sessions (id, sessionKey, status, direction, from_number, to_number, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.execute(sql, [
      sessionData.id || crypto.randomUUID(),
      sessionData.sessionKey,
      sessionData.status || 'queued',
      sessionData.direction,
      sessionData.from_number,
      sessionData.to_number,
      sessionData.started_at || new Date().toISOString(),
    ]);
    return await this.findCallSessionByKey(sessionData.sessionKey);
  }

  async findCallSessionByKey(sessionKey) {
    const sql = `SELECT * FROM call_sessions WHERE sessionKey = ?`;
    return await this.queryOne(sql, [sessionKey]);
  }

  async updateCallSession(sessionKey, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const sql = `UPDATE call_sessions SET ${setClause}, updatedAt = datetime('now') WHERE sessionKey = ?`;
    await this.execute(sql, [...values, sessionKey]);
    return await this.findCallSessionByKey(sessionKey);
  }

  /**
   * Call Legs methods
   */
  async createCallLeg(legData) {
    const sql = `
      INSERT INTO call_legs (id, call_control_id, sessionKey, leg_type, direction, status, start_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.execute(sql, [
      legData.id || crypto.randomUUID(),
      legData.call_control_id,
      legData.sessionKey,
      legData.leg_type,
      legData.direction,
      legData.status || 'new',
      legData.start_time || new Date().toISOString(),
    ]);
    return await this.findCallLegByControlId(legData.call_control_id);
  }

  async findCallLegByControlId(call_control_id) {
    const sql = `SELECT * FROM call_legs WHERE call_control_id = ?`;
    return await this.queryOne(sql, [call_control_id]);
  }

  async findCallLegsBySessionKey(sessionKey) {
    const sql = `SELECT * FROM call_legs WHERE sessionKey = ? ORDER BY createdAt ASC`;
    const result = await this.query(sql, [sessionKey]);
    return result.results || [];
  }

  async updateCallLeg(call_control_id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const sql = `UPDATE call_legs SET ${setClause}, updatedAt = datetime('now') WHERE call_control_id = ?`;
    await this.execute(sql, [...values, call_control_id]);
    return await this.findCallLegByControlId(call_control_id);
  }

  /**
   * Conversations methods
   */
  async createConversation(conversationData) {
    const sql = `
      INSERT INTO Conversations (id, conversation_id, from_number, to_number, agent_assigned, assigned, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.execute(sql, [
      conversationData.id || crypto.randomUUID(),
      conversationData.conversation_id,
      conversationData.from_number,
      conversationData.to_number,
      conversationData.agent_assigned,
      conversationData.assigned ? 1 : 0,
      conversationData.tag,
    ]);
    return await this.findConversationById(conversationData.conversation_id);
  }

  async findConversationById(conversation_id) {
    const sql = `SELECT * FROM Conversations WHERE conversation_id = ?`;
    return await this.queryOne(sql, [conversation_id]);
  }

  async updateConversation(conversation_id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const sql = `UPDATE Conversations SET ${setClause}, updatedAt = datetime('now') WHERE conversation_id = ?`;
    await this.execute(sql, [...values, conversation_id]);
    return await this.findConversationById(conversation_id);
  }

  async getAllConversations() {
    const sql = `SELECT * FROM Conversations ORDER BY updatedAt DESC`;
    const result = await this.query(sql);
    return result.results || [];
  }

  /**
   * Messages methods
   */
  async createMessage(messageData) {
    const sql = `
      INSERT INTO Messages (id, direction, type, telnyx_number, destination_number, text_body, media, tag, conversation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.execute(sql, [
      messageData.id || crypto.randomUUID(),
      messageData.direction,
      messageData.type,
      messageData.telnyx_number,
      messageData.destination_number,
      messageData.text_body,
      messageData.media,
      messageData.tag,
      messageData.conversation_id,
    ]);
    return { id: messageData.id, ...messageData };
  }

  async getMessagesByConversationId(conversation_id) {
    const sql = `SELECT * FROM Messages WHERE conversation_id = ? ORDER BY createdAt ASC`;
    const result = await this.query(sql, [conversation_id]);
    return result.results || [];
  }

  /**
   * Voices (Queue) methods
   */
  async createVoiceEntry(voiceData) {
    const sql = `
      INSERT INTO Voices (uuid, direction, telnyx_number, destination_number, queue_name, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.execute(sql, [
      voiceData.uuid,
      voiceData.direction,
      voiceData.telnyx_number,
      voiceData.destination_number,
      voiceData.queue_name,
      voiceData.status || 'queued',
    ]);
    return await this.findVoiceByUuid(voiceData.uuid);
  }

  async findVoiceByUuid(uuid) {
    const sql = `SELECT * FROM Voices WHERE uuid = ?`;
    return await this.queryOne(sql, [uuid]);
  }

  async updateVoice(uuid, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const sql = `UPDATE Voices SET ${setClause}, updatedAt = datetime('now') WHERE uuid = ?`;
    await this.execute(sql, [...values, uuid]);
    return await this.findVoiceByUuid(uuid);
  }

  async getQueuedCalls() {
    const sql = `SELECT * FROM Voices WHERE status = 'queued' ORDER BY createdAt ASC`;
    const result = await this.query(sql);
    return result.results || [];
  }
}

module.exports = { D1Adapter };
