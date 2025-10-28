'use client';

import React, { useState } from 'react';
import {
  Select,
  MenuItem,
  Box,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { COUNTRY_CODES, CountryCode } from '@/utils/phoneValidation';

interface CountryCodeSelectorProps {
  value: string;
  onChange: (dialCode: string) => void;
  size?: 'small' | 'medium';
  disabled?: boolean;
}

export const CountryCodeSelector: React.FC<CountryCodeSelectorProps> = ({
  value,
  onChange,
  size = 'small',
  disabled = false,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);

  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value);
  };

  // Find the currently selected country
  const selectedCountry = COUNTRY_CODES.find((c) => c.dialCode === value) || COUNTRY_CODES[0];

  return (
    <Select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      size={size}
      open={searchOpen}
      onOpen={() => setSearchOpen(true)}
      onClose={() => setSearchOpen(false)}
      renderValue={(selected) => {
        const country = COUNTRY_CODES.find((c) => c.dialCode === selected) || COUNTRY_CODES[0];
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              component="span"
              sx={{
                fontSize: size === 'small' ? '1rem' : '1.125rem',
                lineHeight: 1,
              }}
            >
              {country.flag}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: size === 'small' ? '0.875rem' : '1rem',
                fontWeight: 500,
              }}
            >
              {country.dialCode}
            </Typography>
          </Box>
        );
      }}
      sx={{
        minWidth: size === 'small' ? 100 : 120,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'divider',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.5),
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: 'primary.main',
        },
        bgcolor: (theme) => alpha(theme.palette.background.default, 0.6),
      }}
      MenuProps={{
        PaperProps: {
          sx: {
            maxHeight: 300,
            '& .MuiMenuItem-root': {
              py: 1,
            },
          },
        },
      }}
    >
      {COUNTRY_CODES.map((country) => (
        <MenuItem key={country.code} value={country.dialCode}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
            <Typography
              component="span"
              sx={{
                fontSize: '1.125rem',
                lineHeight: 1,
                minWidth: 28,
              }}
            >
              {country.flag}
            </Typography>
            <Box sx={{ flexGrow: 1 }}>
              <Typography
                component="span"
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {country.name}
              </Typography>
            </Box>
            <Typography
              component="span"
              sx={{
                fontSize: '0.875rem',
                color: 'text.secondary',
                fontFamily: 'monospace',
              }}
            >
              {country.dialCode}
            </Typography>
          </Box>
        </MenuItem>
      ))}
    </Select>
  );
};

export default CountryCodeSelector;
