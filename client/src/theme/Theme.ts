import { createTheme, ThemeOptions } from '@mui/material/styles';

// Modern color palette with Telnyx green
const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // Light mode colors
          primary: {
            main: '#00CC83', // Brighter Telnyx green
            light: '#4DFFB8',
            dark: '#00995E',
            contrastText: '#FFFFFF',
          },
          secondary: {
            main: '#6366F1', // Modern indigo
            light: '#818CF8',
            dark: '#4F46E5',
            contrastText: '#FFFFFF',
          },
          background: {
            default: '#F8FAFC', // Subtle gray-blue
            paper: '#FFFFFF',
          },
          text: {
            primary: '#0F172A', // Slate 900
            secondary: '#64748B', // Slate 500
            disabled: '#CBD5E1', // Slate 300
          },
          divider: 'rgba(15, 23, 42, 0.08)',
          success: {
            main: '#10B981', // Emerald 500
            light: '#34D399',
            dark: '#059669',
          },
          error: {
            main: '#EF4444', // Red 500
            light: '#F87171',
            dark: '#DC2626',
          },
          warning: {
            main: '#F59E0B', // Amber 500
            light: '#FBBF24',
            dark: '#D97706',
          },
          info: {
            main: '#3B82F6', // Blue 500
            light: '#60A5FA',
            dark: '#2563EB',
          },
        }
      : {
          // Dark mode colors
          primary: {
            main: '#00E896', // Vibrant green for dark mode
            light: '#4DFFB8',
            dark: '#00CC83',
            contrastText: '#0F172A',
          },
          secondary: {
            main: '#818CF8', // Lighter indigo for dark
            light: '#A5B4FC',
            dark: '#6366F1',
            contrastText: '#0F172A',
          },
          background: {
            default: '#0F172A', // Slate 900
            paper: '#1E293B', // Slate 800
          },
          text: {
            primary: '#F1F5F9', // Slate 100
            secondary: '#94A3B8', // Slate 400
            disabled: '#475569', // Slate 600
          },
          divider: 'rgba(241, 245, 249, 0.12)',
          success: {
            main: '#34D399',
            light: '#6EE7B7',
            dark: '#10B981',
          },
          error: {
            main: '#F87171',
            light: '#FCA5A5',
            dark: '#EF4444',
          },
          warning: {
            main: '#FBBF24',
            light: '#FCD34D',
            dark: '#F59E0B',
          },
          info: {
            main: '#60A5FA',
            light: '#93C5FD',
            dark: '#3B82F6',
          },
        }),
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
    h1: {
      fontWeight: 800,
      fontSize: '2.75rem',
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2.25rem',
      lineHeight: 1.25,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 700,
      fontSize: '1.875rem',
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
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
      fontSize: '1.125rem',
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.625,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.57,
      letterSpacing: '0.00714em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.02em',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.75,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.57,
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    // Softer, more modern shadows
    '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06)',
    '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)',
    '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)',
    '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
    ...Array(14).fill('0px 25px 50px -12px rgba(0, 0, 0, 0.25)'),
  ] as any,
});

const theme = createTheme({
  ...getDesignTokens('dark'),
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        body: {
          background: theme.palette.mode === 'light'
            ? 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)'
            : 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          minHeight: '100vh',
          scrollbarWidth: 'thin',
          scrollbarColor: theme.palette.mode === 'light'
            ? '#CBD5E1 #F1F5F9'
            : '#475569 #1E293B',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: theme.palette.mode === 'light' ? '#F1F5F9' : '#1E293B',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'light' ? '#CBD5E1' : '#475569',
            borderRadius: '4px',
            '&:hover': {
              background: theme.palette.mode === 'light' ? '#94A3B8' : '#64748B',
            },
          },
        },
      }),
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 16,
          boxShadow: theme.palette.mode === 'light'
            ? '0px 4px 20px rgba(0, 0, 0, 0.06)'
            : '0px 4px 20px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: theme.palette.mode === 'light'
              ? '0px 12px 40px rgba(0, 0, 0, 0.12)'
              : '0px 12px 40px rgba(0, 0, 0, 0.5)',
          },
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.9375rem',
          padding: '10px 24px',
          boxShadow: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.palette.mode === 'light'
              ? '0px 8px 16px rgba(0, 0, 0, 0.15)'
              : '0px 8px 16px rgba(0, 0, 0, 0.4)',
          },
          '&:active': {
            transform: 'translateY(0px)',
          },
        }),
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        sizeLarge: {
          padding: '12px 32px',
          fontSize: '1rem',
        },
        sizeSmall: {
          padding: '6px 16px',
          fontSize: '0.8125rem',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '& fieldset': {
              borderColor: theme.palette.divider,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            },
            '&:hover': {
              '& fieldset': {
                borderColor: theme.palette.primary.main,
              },
            },
            '&.Mui-focused': {
              '& fieldset': {
                borderWidth: 2,
                borderColor: theme.palette.primary.main,
              },
            },
          },
        }),
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 16,
          boxShadow: theme.palette.mode === 'light'
            ? '0px 4px 20px rgba(0, 0, 0, 0.06)'
            : '0px 4px 20px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
        }),
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: ({ theme }) => ({
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: theme.palette.mode === 'light'
              ? 'rgba(0, 204, 131, 0.04)'
              : 'rgba(0, 232, 150, 0.08)',
          },
          '&:not(:last-child)': {
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRight: `1px solid ${theme.palette.divider}`,
          padding: '16px 20px',
          '&:last-child': {
            borderRight: '0',
          },
        }),
        head: ({ theme }) => ({
          backgroundColor: theme.palette.mode === 'light'
            ? 'rgba(0, 204, 131, 0.06)'
            : 'rgba(0, 232, 150, 0.1)',
          fontWeight: 700,
          fontSize: '0.875rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: theme.palette.text.primary,
          borderBottom: `2px solid ${theme.palette.primary.main}`,
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 16,
          backgroundImage: 'none',
        }),
        elevation1: ({ theme }) => ({
          boxShadow: theme.palette.mode === 'light'
            ? '0px 2px 8px rgba(0, 0, 0, 0.05)'
            : '0px 2px 8px rgba(0, 0, 0, 0.3)',
        }),
        elevation2: ({ theme }) => ({
          boxShadow: theme.palette.mode === 'light'
            ? '0px 4px 16px rgba(0, 0, 0, 0.08)'
            : '0px 4px 16px rgba(0, 0, 0, 0.4)',
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: theme.palette.mode === 'light'
            ? '0px 2px 12px rgba(0, 0, 0, 0.06)'
            : '0px 2px 12px rgba(0, 0, 0, 0.3)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          backdropFilter: 'blur(20px)',
          backgroundColor: theme.palette.mode === 'light'
            ? 'rgba(255, 255, 255, 0.8)'
            : 'rgba(30, 41, 59, 0.8)',
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRight: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.palette.mode === 'light'
            ? '4px 0px 20px rgba(0, 0, 0, 0.06)'
            : '4px 0px 20px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(20px)',
          backgroundColor: theme.palette.mode === 'light'
            ? 'rgba(255, 255, 255, 0.95)'
            : 'rgba(30, 41, 59, 0.95)',
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        },
        filled: ({ theme }) => ({
          backgroundColor: theme.palette.mode === 'light'
            ? 'rgba(0, 204, 131, 0.1)'
            : 'rgba(0, 232, 150, 0.15)',
          color: theme.palette.primary.main,
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 20,
          boxShadow: theme.palette.mode === 'light'
            ? '0px 20px 60px rgba(0, 0, 0, 0.2)'
            : '0px 20px 60px rgba(0, 0, 0, 0.6)',
        }),
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }) => ({
          backgroundColor: theme.palette.mode === 'light'
            ? 'rgba(15, 23, 42, 0.95)'
            : 'rgba(241, 245, 249, 0.95)',
          color: theme.palette.mode === 'light'
            ? '#F1F5F9'
            : '#0F172A',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.8125rem',
          fontWeight: 500,
          backdropFilter: 'blur(8px)',
          boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
        }),
        arrow: ({ theme }) => ({
          color: theme.palette.mode === 'light'
            ? 'rgba(15, 23, 42, 0.95)'
            : 'rgba(241, 245, 249, 0.95)',
        }),
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          height: 6,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          padding: 8,
        },
        track: {
          borderRadius: 12,
        },
        thumb: {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
        },
      },
    },
  },
});

export default theme;
