import { EventEmitter } from 'node:events';

/**
 * Central event bus for the contact center application.
 */
const bus = new EventEmitter();

bus.setMaxListeners(100);

export default bus;
