'use client';

import React, { useEffect, useMemo, useRef, useState, useContext } from 'react';
import { TelnyxRTCContext } from '@telnyx/react-client';
import {
  getState as getCallState,
  subscribe as subscribeCallState,
  setStatus as storeSetStatus,
  setToNumber as storeSetToNumber,
  setCall as storeSetCall,
  setMuted as storeSetMuted,
  setHeld as storeSetHeld,
  clear as storeClear,
} from '@/lib/call-store';
import {
  Phone,
  Mic,
  MicOff,
  Pause,
  PlayArrow,
  CallEnd,
  KeyboardArrowDown,
} from '@mui/icons-material';
import { Box, IconButton, TextField, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { usePhoneUi } from '@/contexts/PhoneUiProvider';
import { isValidDialTo, validatePhoneNumberWithCountry, buildPhoneNumber } from '@/utils/phoneValidation';
import CountryCodeSelector from './CountryCodeSelector';

const SoftphoneMini: React.FC = () => {
  const client = useContext(TelnyxRTCContext);
  const { toggle, selectedFromNumber } = usePhoneUi();
  const [state, setState] = useState(getCallState());
  const [toInput, setToInput] = useState(getCallState().toNumber || '');
  const [countryCode, setCountryCode] = useState('+1'); // Default to US
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => subscribeCallState(setState), []);

  useEffect(() => {
    if (state.toNumber !== toInput) setToInput(state.toNumber || '');
  }, [state.toNumber, toInput]);

  const canCall = useMemo(() => {
    return !state.call && isValidDialTo(state.toNumber);
  }, [state.call, state.toNumber]);

  function startCall(event?: React.MouseEvent) {
    // Prevent any default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const clientObj = client;
    const from = selectedFromNumber || '';
    let to = (state.toNumber || '').trim();
    if (!to || state.call || !clientObj) return;

    // Build full phone number with country code if needed
    if (to && !to.startsWith('+') && !to.includes('sip:')) {
      to = buildPhoneNumber(countryCode, to);
    }

    // Validate phone number with country-specific rules
    const error = validatePhoneNumberWithCountry(state.toNumber || '', countryCode);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);

    // Directly place the call without opening modal
    try {
      storeSetStatus('dialing');

      const call = clientObj.newCall({
        destinationNumber: to,
        callerNumber: from || undefined,
        audio: true,
        video: false,
      });

      storeSetCall(call);

      try {
        clientObj.enableMicrophone?.();
      } catch (_) {}

      // Set up call event handlers
      try {
        call.on?.('ringing', () => {
          storeSetStatus('ringing');
        });
        call.on?.('active', () => {
          storeSetStatus('connected');
        });
        call.on?.('hangup', () => {
          storeSetStatus('ended');
          storeClear();
        });
        call.on?.('destroy', () => {
          storeSetStatus('ended');
          storeClear();
        });
        call.on?.('error', (error: any) => {
          console.warn('Call error:', error);
          setValidationError(error?.message || 'Call error occurred');
        });
      } catch (_) {}

      if (typeof call.invite === 'function') call.invite();
    } catch (err: any) {
      storeSetStatus('idle');
      setValidationError(err?.message || 'Failed to start call');
    }
  }

  async function toggleMute() {
    try {
      const call = state.call;
      if (!call) return;
      if (!state.isMuted) {
        call.muteAudio?.() || call.mute?.();
        storeSetMuted(true);
      } else {
        call.unmuteAudio?.() || call.unmute?.();
        storeSetMuted(false);
      }
    } catch (_) {}
  }

  async function toggleHold() {
    try {
      const call = state.call;
      if (!call) return;
      const held = state.isHeld;
      if (held) {
        call.unhold?.() || call.resume?.();
        storeSetHeld(false);
      } else {
        call.hold?.() || call.pause?.();
        storeSetHeld(true);
      }
    } catch (_) {}
  }

  function hangup() {
    try {
      state.call?.hangup?.();
    } catch (_) {}
    try {
      storeClear();
    } catch (_) {}
  }

  return (
    <Box
      sx={{
        display: { xs: 'none', sm: 'flex' },
        alignItems: 'center',
        gap: 1,
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.5,
        py: 0.75,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
    >
      <CountryCodeSelector
        value={countryCode}
        onChange={setCountryCode}
        size="small"
      />
      <Tooltip title={validationError || ''} open={!!validationError} arrow>
        <TextField
          value={toInput}
          onChange={(e) => {
            const v = e.target.value;
            setToInput(v);
            setValidationError(null);
            try {
              storeSetToNumber(v);
            } catch (_) {}
          }}
          placeholder="Phone number or SIP URI"
          size="small"
          error={!!validationError}
          sx={{
            width: 200,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.875rem',
              height: 32,
              bgcolor: (theme) => alpha(theme.palette.background.default, 0.6),
              color: 'text.primary',
              borderRadius: 1,
              transition: 'all 0.2s',
              '& fieldset': {
                borderColor: validationError ? 'error.main' : 'divider',
              },
              '&:hover fieldset': {
                borderColor: (theme) => validationError ? 'error.main' : alpha(theme.palette.primary.main, 0.5),
              },
              '&.Mui-focused fieldset': {
                borderColor: validationError ? 'error.main' : 'primary.main',
              },
            },
            '& .MuiOutlinedInput-input': {
              color: 'text.primary',
              '&::placeholder': {
                color: 'text.secondary',
                opacity: 0.7,
              },
            },
          }}
        />
      </Tooltip>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        disabled={!state.call}
        sx={{
          bgcolor: state.call
            ? (theme) => alpha(theme.palette.background.paper, 0.8)
            : (theme) => alpha(theme.palette.background.paper, 0.4),
          color: 'text.primary',
          width: 32,
          height: 32,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            borderColor: 'primary.main',
            transform: 'scale(1.05)',
          },
          '&:disabled': {
            opacity: 0.4,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.2),
            color: 'text.disabled',
          },
        }}
        title={state.isMuted ? 'Unmute' : 'Mute'}
      >
        {state.isMuted ? <MicOff sx={{ fontSize: 18 }} /> : <Mic sx={{ fontSize: 18 }} />}
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          state.call ? hangup() : startCall(e);
        }}
        disabled={!canCall && !state.call}
        sx={{
          bgcolor: state.call ? 'error.main' : canCall ? '#10b981' : (theme) => alpha(theme.palette.background.paper, 0.4),
          color: 'white',
          width: 32,
          height: 32,
          border: state.call || canCall ? 'none' : '1px solid',
          borderColor: 'divider',
          transition: 'all 0.2s',
          boxShadow: state.call || canCall ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none',
          '&:hover': {
            bgcolor: state.call ? 'error.dark' : canCall ? '#059669' : (theme) => alpha(theme.palette.background.paper, 0.6),
            transform: 'scale(1.05)',
            boxShadow: state.call || canCall ? '0 4px 12px rgba(0, 0, 0, 0.4)' : 'none',
          },
          '&:disabled': {
            opacity: 0.4,
            color: 'text.disabled',
          },
        }}
        title={state.call ? 'Hang up' : 'Call'}
      >
        {state.call ? <CallEnd sx={{ fontSize: 18 }} /> : <Phone sx={{ fontSize: 18 }} />}
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          toggleHold();
        }}
        disabled={!state.call}
        sx={{
          bgcolor: state.call
            ? (theme) => alpha(theme.palette.background.paper, 0.8)
            : (theme) => alpha(theme.palette.background.paper, 0.4),
          color: 'text.primary',
          width: 32,
          height: 32,
          border: '1px solid',
          borderColor: 'divider',
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            borderColor: 'primary.main',
            transform: 'scale(1.05)',
          },
          '&:disabled': {
            opacity: 0.4,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.2),
            color: 'text.disabled',
          },
        }}
        title={state.isHeld ? 'Unhold' : 'Hold'}
      >
        {state.isHeld ? <PlayArrow sx={{ fontSize: 18 }} /> : <Pause sx={{ fontSize: 18 }} />}
      </IconButton>
      <IconButton
        size="small"
        onClick={toggle}
        sx={{
          ml: 0.5,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          color: 'primary.main',
          width: 32,
          height: 32,
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
            borderColor: 'primary.main',
            transform: 'scale(1.05)',
          },
        }}
        title="Show phone"
      >
        <KeyboardArrowDown sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

export default SoftphoneMini;
