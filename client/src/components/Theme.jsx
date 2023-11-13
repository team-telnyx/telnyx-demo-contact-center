import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#00a37a',
    },
    secondary: {
      main: '#000000',
    },
    text: {
      primary: '#00e3aa',
      secondary: '#fefdf5',
    },
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
  },
  components: {
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:not(:last-child)': {
            borderBottom: '1px solid #ccc',  // Set bottom border on all rows except the last one
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderRight: '1px solid #ccc', // Set right border on all cells
          '&:last-child': {
            borderRight: '0',  // Remove right border from last cell in each row
          },
        },
        head: {
          borderBottom: '1px solid #ccc',  // Set bottom border on header cells
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none', // Remove uppercase transformation
        },
      },
    },
  },
  layout: {
    contentWidth: 1236, // Custom content width
  },
  spacing: 8,
});

export default theme;
