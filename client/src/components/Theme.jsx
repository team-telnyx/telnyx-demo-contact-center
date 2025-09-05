import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00a37a',
      light: '#4dd3a7',
      dark: '#00734f',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#1a1a1a',
      light: '#484848',
      dark: '#000000',
      contrastText: '#ffffff',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#6b6b6b',
    },
    background: {
      default: '#fafafa',
      paper: '#ffffff',
    },
    success: {
      main: '#28a745',
      light: '#6fcf7f',
      dark: '#1e7e34',
    },
    error: {
      main: '#dc3545',
      light: '#ff6b7d',
      dark: '#a71e2a',
    },
    warning: {
      main: '#ffc107',
      light: '#fff350',
      dark: '#b28900',
    },
    info: {
      main: '#17a2b8',
      light: '#5ddef4',
      dark: '#0f6674',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
      lineHeight: 1.3,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.1rem',
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0px 2px 1px -1px rgba(0,0,0,0.05),0px 1px 1px 0px rgba(0,0,0,0.03),0px 1px 3px 0px rgba(0,0,0,0.02)',
    '0px 3px 1px -2px rgba(0,0,0,0.08),0px 2px 2px 0px rgba(0,0,0,0.06),0px 1px 5px 0px rgba(0,0,0,0.04)',
    '0px 3px 3px -2px rgba(0,0,0,0.08),0px 3px 4px 0px rgba(0,0,0,0.06),0px 1px 8px 0px rgba(0,0,0,0.04)',
    '0px 2px 4px -1px rgba(0,0,0,0.08),0px 4px 5px 0px rgba(0,0,0,0.06),0px 1px 10px 0px rgba(0,0,0,0.04)',
    '0px 3px 5px -1px rgba(0,0,0,0.08),0px 5px 8px 0px rgba(0,0,0,0.06),0px 1px 14px 0px rgba(0,0,0,0.04)',
    '0px 3px 5px -1px rgba(0,0,0,0.08),0px 6px 10px 0px rgba(0,0,0,0.06),0px 1px 18px 0px rgba(0,0,0,0.04)',
    '0px 4px 5px -2px rgba(0,0,0,0.08),0px 7px 10px 1px rgba(0,0,0,0.06),0px 2px 16px 1px rgba(0,0,0,0.04)',
    '0px 5px 5px -3px rgba(0,0,0,0.08),0px 8px 10px 1px rgba(0,0,0,0.06),0px 3px 14px 2px rgba(0,0,0,0.04)',
    '0px 5px 6px -3px rgba(0,0,0,0.08),0px 9px 12px 1px rgba(0,0,0,0.06),0px 3px 16px 2px rgba(0,0,0,0.04)',
    '0px 6px 6px -3px rgba(0,0,0,0.08),0px 10px 14px 1px rgba(0,0,0,0.06),0px 4px 18px 3px rgba(0,0,0,0.04)',
    ...Array(14).fill('0px 6px 6px -3px rgba(0,0,0,0.08),0px 10px 14px 1px rgba(0,0,0,0.06),0px 4px 18px 3px rgba(0,0,0,0.04)')
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
          minHeight: '100vh',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.05)',
          '&:hover': {
            boxShadow: '0px 8px 30px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.95rem',
          padding: '10px 24px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#00a37a',
            },
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.05)',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0, 163, 122, 0.04)',
          },
          '&:not(:last-child)': {
            borderBottom: '1px solid rgba(0,0,0,0.08)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderRight: '1px solid rgba(0,0,0,0.08)',
          padding: '16px',
          '&:last-child': {
            borderRight: '0',
          },
        },
        head: {
          backgroundColor: 'rgba(0, 163, 122, 0.05)',
          fontWeight: 600,
          color: '#1a1a1a',
          borderBottom: '2px solid rgba(0, 163, 122, 0.2)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 4px 20px rgba(0,0,0,0.08)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '4px 0px 20px rgba(0,0,0,0.08)',
        },
      },
    },
  },
  layout: {
    contentWidth: 1236,
  },
  spacing: 8,
});

export default theme;
