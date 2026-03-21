// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock environment
process.env.REACT_APP_API_HOST = 'localhost';
process.env.REACT_APP_API_PORT = '3000';
