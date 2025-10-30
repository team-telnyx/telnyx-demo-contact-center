'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import ReactDOM from 'react-dom';
import { TelnyxRTCContext } from '@telnyx/react-client';
import { playDtmfBeep } from '@/lib/dtmf';
import {
  setCall as storeSetCall,
  setStatus as storeSetStatus,
  setToNumber as storeSetToNumber,
  setMuted as storeSetMuted,
  setHeld as storeSetHeld,
  clear as storeClear,
  subscribe as storeSubscribe,
  getState as storeGetState,
} from '@/lib/call-store';
import { validatePhoneNumberWithCountry, buildPhoneNumber, COUNTRY_CODES } from '@/utils/phoneValidation';
import CountryCodeSelector from './CountryCodeSelector';
import {
  Phone as IconPhone,
  CallEnd as IconPhoneOff,
  VolumeUp as IconSpeaker,
  Mic as IconMic,
  MicOff as IconMicOff,
  Tag as IconHash,
  ExpandMore as IconChevronDown,
  Pause as IconPause,
  PlayArrow as IconPlay,
  BarChart as IconStats,
  Timer as IconTimer,
} from '@mui/icons-material';
import { usePhoneUi } from '@/contexts/PhoneUiProvider';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Button,
  Collapse,
  Divider,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Draggable from 'react-draggable';

function CircleButton({
  children,
  onClick,
  disabled,
  color = 'default',
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  color?: 'default' | 'error' | 'success';
  title?: string;
}) {
  return (
    <IconButton
      onClick={onClick}
      disabled={disabled}
      title={title}
      sx={{
        width: 48,
        height: 48,
        bgcolor:
          color === 'error'
            ? 'error.main'
            : color === 'success'
            ? '#10b981'
            : (theme) => alpha(theme.palette.background.paper, 0.8),
        color: 'white',
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.divider, 0.3),
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor:
            color === 'error'
              ? 'error.dark'
              : color === 'success'
              ? '#059669'
              : (theme) => alpha(theme.palette.background.paper, 0.9),
          transform: 'scale(1.05)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        },
        '&:active': {
          transform: 'scale(0.98)',
        },
        '&:disabled': {
          opacity: 0.5,
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.4),
          color: (theme) => alpha(theme.palette.text.primary, 0.3),
        },
      }}
    >
      {children}
    </IconButton>
  );
}

function isValidE164(number: string) {
  return /^\+?[1-9]\d{6,14}$/.test(String(number || '').trim());
}

function isValidSipUri(input: string) {
  return /^sip:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(String(input || '').trim());
}

function isValidDialTo(value: string) {
  const v = String(value || '').trim();
  if (!v) return false;
  return isValidE164(v) || isValidSipUri(v);
}

function isValidFrom(value: string) {
  const v = String(value || '').trim();
  if (!v) return true; // optional
  return isValidE164(v) || isValidSipUri(v);
}

export function Softphone() {
  const client = useContext(TelnyxRTCContext);
  const { isOpen, open, close, selectedFromNumber, availableNumbers, setSelectedFromNumber } = usePhoneUi();
  const [toNumber, setToNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1'); // Default to US
  const [validationError, setValidationError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [dtmfBuffer, setDtmfBuffer] = useState('');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
  const [showMicList, setShowMicList] = useState(false);
  const [showSpkList, setShowSpkList] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [showDtmf, setShowDtmf] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStats, setCallStats] = useState<any>(null);
  const callStartTimeRef = useRef<number | null>(null);

  const callRef = useRef<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef(null);

  const hydrateRemoteAudio = useCallback(() => {
    try {
      const call = callRef.current;
      const audioEl = remoteAudioRef.current;
      if (!call || !audioEl) return;
      const possibleStream = call.remoteStream || call.remoteMediaStream || call.stream;
      if (possibleStream && audioEl.srcObject !== possibleStream) {
        audioEl.srcObject = possibleStream;
        // Audio element has autoPlay attribute, no need to call play() manually
      }
      if (typeof call.setAudioElement === 'function' && audioEl) {
        try {
          call.setAudioElement(audioEl);
          // Audio element has autoPlay attribute, no need to call play() manually
        } catch (_) {}
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!client) return;
    const unsubscribe = storeSubscribe((s) => {
      try {
        if (s.call && s.call !== callRef.current) {
          callRef.current = s.call;
        }
        if (s.status) setCallStatus(s.status);
        if (typeof s.isMuted === 'boolean') setIsMuted(s.isMuted);
        if (typeof s.toNumber === 'string' && s.toNumber !== toNumber) {
          setToNumber(s.toNumber);
        }
      } catch (_) {}
    });
    return () => unsubscribe();
  }, [client, toNumber]);

  // Auto-expand softphone when a call comes in
  useEffect(() => {
    const s = String(callStatus || '').toLowerCase();
    if (['dialing', 'ringing', 'connected', 'active'].includes(s)) {
      try {
        open();
      } catch (_) {}
    }
  }, [callStatus, open]);

  useEffect(() => {
    if (!client) return;
    const onNotification = (notification: any) => {
      try {
        const call = notification?.call || null;
        if (call) {
          if (!callRef.current || callRef.current !== call) {
            callRef.current = call;
            try {
              storeSetCall(call);
            } catch (_) {}
          }
          const state = call.state || notification?.call?.state || '';
          if (state) {
            setCallStatus(state);
            try {
              storeSetStatus(state);
            } catch (_) {}
          }
          hydrateRemoteAudio();
          try {
            const s = String(state || '').toLowerCase();
            if (['hangup', 'ended', 'destroy', 'idle', 'terminated'].includes(s)) {
              callRef.current = null;
              setIsMuted(false);
              setDtmfBuffer('');
              setInCall(false);
              setErrorMessage('');
              try {
                storeClear();
              } catch (_) {}
            } else if (s === 'held') {
              try {
                storeSetHeld(true);
              } catch (_) {}
            } else if (s === 'active' || s === 'connected') {
              try {
                storeSetHeld(false);
              } catch (_) {}
            }
          } catch (_) {}
        }
      } catch (_) {}
    };
    try {
      client.on?.('telnyx.notification', onNotification);
    } catch (_) {}
    return () => {
      try {
        client.off?.('telnyx.notification', onNotification) ||
          client.removeListener?.('telnyx.notification', onNotification);
      } catch (_) {}
    };
  }, [client, hydrateRemoteAudio]);

  const canCall = useMemo(() => {
    return !inCall && isValidDialTo(toNumber) && isValidFrom(selectedFromNumber);
  }, [inCall, toNumber, selectedFromNumber]);

  const handleStartCall = useCallback((event?: React.MouseEvent) => {
    // Prevent any default behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const clientObj = client;
    const from = (selectedFromNumber || '').trim();
    let to = (toNumber || '').trim();

    // Build full phone number with country code if needed
    if (to && !to.startsWith('+') && !to.includes('sip:')) {
      to = buildPhoneNumber(countryCode, to);
    }

    // Validate phone number with country-specific rules
    const error = validatePhoneNumberWithCountry(toNumber, countryCode);
    if (error) {
      setValidationError(error);
      setErrorMessage(error);
      return;
    }

    if (!clientObj || !to) return;

    setValidationError(null);
    setErrorMessage('');
    setCallStatus('dialing');
    setInCall(true);
    storeSetStatus('dialing');
    try {
      const call = clientObj.newCall({
        destinationNumber: to,
        callerNumber: from || undefined,
        audio: true,
        video: false,
      });
      callRef.current = call;
      storeSetCall(call);
      try {
        clientObj.enableMicrophone?.();
      } catch (_) {}
      try {
        hydrateRemoteAudio();
      } catch (_) {}
      try {
        call.on?.('ringing', () => {
          setCallStatus('ringing');
          storeSetStatus('ringing');
        });
        call.on?.('active', () => {
          setCallStatus('connected');
          storeSetStatus('connected');
          hydrateRemoteAudio();
        });
        call.on?.('hangup', () => {
          setCallStatus('ended');
          callRef.current = null;
          setDtmfBuffer('');
          setInCall(false);
          setErrorMessage('');
          try {
            storeClear();
          } catch (_) {}
        });
        call.on?.('destroy', () => {
          setCallStatus('ended');
          callRef.current = null;
          setDtmfBuffer('');
          setInCall(false);
          setErrorMessage('');
          try {
            storeClear();
          } catch (_) {}
        });
        call.on?.('error', (error: any) => {
          console.warn('Call error:', error);
          setErrorMessage(error?.message || 'Call error occurred');
        });
        call.on?.('stateChanged', () => {
          try {
            const state = call.state || '';
            if (state) {
              setCallStatus(state);
              storeSetStatus(state);
            }
            const s = String(state || '').toLowerCase();
            if (['hangup', 'ended', 'destroy', 'idle', 'terminated'].includes(s)) {
              callRef.current = null;
              setIsMuted(false);
              setDtmfBuffer('');
              setInCall(false);
              setErrorMessage('');
              try {
                storeClear();
              } catch (_) {}
            } else if (s === 'held') {
              try {
                storeSetHeld(true);
              } catch (_) {}
            } else if (s === 'active' || s === 'connected') {
              try {
                storeSetHeld(false);
              } catch (_) {}
            }
          } catch (error) {
            console.warn('State change error:', error);
          }
        });
      } catch (_) {}
      if (typeof call.invite === 'function') call.invite();
    } catch (err: any) {
      setCallStatus('idle');
      setInCall(false);
      setErrorMessage(err?.message || 'Failed to start call');
    }
  }, [client, selectedFromNumber, toNumber, hydrateRemoteAudio]);

  const handleHangup = useCallback(() => {
    const call = callRef.current;
    if (!call) return;

    callRef.current = null;
    setCallStatus('ended');
    setInCall(false);
    setErrorMessage('');

    try {
      if (
        call.state &&
        !['hangup', 'ended', 'destroy', 'idle'].includes(call.state.toLowerCase())
      ) {
        call.hangup?.();
      }
    } catch (error) {
      console.warn('Call hangup error (non-blocking):', error);
    }

    try {
      storeClear();
    } catch (_) {}
  }, []);

  const handleToggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    try {
      if (!isMuted) {
        call.muteAudio?.() || call.mute?.();
        setIsMuted(true);
        storeSetMuted(true);
      } else {
        call.unmuteAudio?.() || call.unmute?.();
        setIsMuted(false);
        storeSetMuted(false);
      }
    } catch (_) {}
  }, [isMuted]);

  const handleToggleHold = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    try {
      const s = String(callStatus || '').toLowerCase();
      if (s === 'held') {
        call.unhold?.() || call.resume?.();
        storeSetHeld(false);
      } else {
        call.hold?.() || call.pause?.();
        storeSetHeld(true);
      }
    } catch (_) {}
  }, [callStatus]);

  // Set up portal target
  useEffect(() => {
    setPortalTarget(document.getElementById('modal-root') || document.body);
  }, []);

  // Initialize toNumber from store
  useEffect(() => {
    const currentState = storeGetState();
    if (currentState.toNumber) {
      setToNumber(currentState.toNumber);
    }
  }, []);

  const isCallActive = useMemo(() => {
    const s = String(callStatus || '').toLowerCase();
    return ['connected', 'active', 'answered'].includes(s);
  }, [callStatus]);

  const handleKeypadDigit = useCallback(
    (digit: string) => {
      if (!isCallActive) return;
      playDtmfBeep(digit, audioCtxRef);
      setDtmfBuffer((prev) => (prev + String(digit)).slice(-32));
      const call = callRef.current;
      try {
        if (typeof call?.dtmf === 'function') {
          call.dtmf(String(digit));
          return;
        }
      } catch (_) {}
      try {
        if (typeof call?.sendDTMF === 'function') {
          call.sendDTMF(String(digit));
          return;
        }
      } catch (_) {}
    },
    [isCallActive]
  );

  const keypadDigits = useMemo(
    () => [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#'],
    ],
    []
  );

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const ins = devices.filter((d) => d.kind === 'audioinput');
      const outs = devices.filter((d) => d.kind === 'audiooutput');
      setAudioInputs(ins);
      setAudioOutputs(outs);
      if (!selectedMicId && ins[0]?.deviceId) setSelectedMicId(ins[0].deviceId);
      if (!selectedSpeakerId && outs[0]?.deviceId) setSelectedSpeakerId(outs[0].deviceId);
    } catch (_) {}
  }, [selectedMicId, selectedSpeakerId]);

  useEffect(() => {
    refreshDevices();
    const onDeviceChange = () => refreshDevices();
    try {
      navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    } catch (_) {}
    return () => {
      try {
        navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
      } catch (_) {}
    };
  }, [refreshDevices]);

  const applyMicSelection = useCallback(
    async (deviceId: string) => {
      if (!deviceId || !client) return;
      try {
        if (typeof client.updateAudioConstraints === 'function') {
          await client.updateAudioConstraints({ deviceId });
          return;
        }
      } catch (_) {}
    },
    [client]
  );

  const applySpeakerSelection = useCallback(async (deviceId: string) => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl || !deviceId) return;
    try {
      if (typeof audioEl.setSinkId === 'function') {
        await (audioEl as any).setSinkId(deviceId);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (selectedMicId) applyMicSelection(selectedMicId);
  }, [selectedMicId, applyMicSelection]);

  useEffect(() => {
    if (selectedSpeakerId) applySpeakerSelection(selectedSpeakerId);
  }, [selectedSpeakerId, applySpeakerSelection]);

  // Call duration timer - start when call becomes active
  useEffect(() => {
    const s = String(callStatus || '').toLowerCase();
    const isActive = ['connected', 'active', 'answered'].includes(s);

    if (isActive && !callStartTimeRef.current) {
      // Call just became active, start timer
      callStartTimeRef.current = Date.now();
    } else if (!isActive && callStartTimeRef.current) {
      // Call ended, reset timer
      callStartTimeRef.current = null;
      setCallDuration(0);
    }

    if (isActive && callStartTimeRef.current) {
      // Update duration every second
      const interval = setInterval(() => {
        if (callStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [callStatus]);

  // Fetch call statistics periodically using Telnyx SDK
  useEffect(() => {
    if (!isCallActive || !callRef.current) {
      setCallStats(null);
      return;
    }

    const fetchStats = () => {
      const call = callRef.current;
      if (!call || typeof call.getStats !== 'function') return;

      try {
        // Use Telnyx SDK's getStats method with callback
        call.getStats((stats: any) => {
          try {
            // Parse the stats object returned by Telnyx SDK
            const parsedStats: any = {
              audio: {},
              connection: {}
            };

            // The stats might be a Map or array of reports
            if (stats && typeof stats.forEach === 'function') {
              stats.forEach((report: any) => {
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                  parsedStats.audio.inbound = {
                    packetsReceived: report.packetsReceived || 0,
                    packetsLost: report.packetsLost || 0,
                    jitter: report.jitter ? (report.jitter * 1000).toFixed(2) : '0',
                    bytesReceived: report.bytesReceived || 0,
                  };
                } else if (report.type === 'outbound-rtp' && report.kind === 'audio') {
                  parsedStats.audio.outbound = {
                    packetsSent: report.packetsSent || 0,
                    bytesSent: report.bytesSent || 0,
                  };
                } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                  parsedStats.connection = {
                    currentRoundTripTime: report.currentRoundTripTime ?
                      (report.currentRoundTripTime * 1000).toFixed(2) : '0',
                    availableOutgoingBitrate: report.availableOutgoingBitrate || 0,
                  };
                } else if (report.type === 'codec' && report.mimeType?.includes('audio')) {
                  parsedStats.codec = {
                    mimeType: report.mimeType,
                    clockRate: report.clockRate,
                    channels: report.channels,
                  };
                }
              });
            } else if (stats && typeof stats === 'object') {
              // Handle if stats is already a parsed object
              parsedStats.raw = stats;
            }

            setCallStats(parsedStats);
          } catch (error) {
            console.warn('Failed to parse call stats:', error);
          }
        }, {});
      } catch (error) {
        console.warn('Failed to fetch call stats:', error);
      }
    };

    // Fetch stats immediately, then every 2 seconds
    fetchStats();
    const interval = setInterval(fetchStats, 2000);

    return () => clearInterval(interval);
  }, [isCallActive]);

  // Format call duration as MM:SS
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Calculate packet loss percentage
  const getPacketLossPercent = useCallback(() => {
    if (!callStats?.audio?.inbound) return '0.00';
    const { packetsReceived = 0, packetsLost = 0 } = callStats.audio.inbound;
    const total = packetsReceived + packetsLost;
    if (total === 0) return '0.00';
    return ((packetsLost / total) * 100).toFixed(2);
  }, [callStats]);

  if (!isOpen || !portalTarget) {
    return null;
  }

  const modalContent = (
    <Box
      sx={{
        position: 'fixed',
        top: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1400, // Higher than MUI Dialog (1300) to float above other modals
        pointerEvents: 'none', // Allow clicks to pass through empty space
      }}
    >
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      <Draggable handle=".draggable-handle" nodeRef={nodeRef}>
        <Box
          ref={nodeRef}
          sx={{
            pointerEvents: 'auto', // But enable clicks on the softphone itself
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Paper
            elevation={8}
            sx={{
              width: '320px',
              maxWidth: '100vw',
              bgcolor: 'background.paper',
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Draggable Header */}
            <Box
              className="draggable-handle"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: 'primary.main',
                px: 2,
                py: 1.5,
                cursor: 'move',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle1" fontWeight={600} color="white">
                Softphone
              </Typography>
              <IconButton
                onClick={close}
                size="small"
                sx={{ color: 'white' }}
                title="Close"
              >
                <IconChevronDown fontSize="small" />
              </IconButton>
            </Box>
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                bgcolor: 'background.default',
                p: 2,
                color: 'text.primary',
              }}
            >
            {/* Device selectors */}
            <Box
              sx={{
                position: 'absolute',
                right: 12,
                top: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={{ position: 'relative' }}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowMicList((v) => !v);
                    setShowSpkList(false);
                  }}
                  title="Select microphone"
                  sx={{
                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.background.paper, 0.8),
                    },
                  }}
                >
                  <IconMic fontSize="small" />
                </IconButton>
                {showMicList && (
                  <Paper
                    elevation={8}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      zIndex: 10,
                      mt: 1,
                      width: 200,
                      maxHeight: 256,
                      overflow: 'auto',
                    }}
                  >
                    <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: 'text.secondary' }}>
                      Microphones
                    </Typography>
                    {audioInputs.map((d) => (
                      <MenuItem
                        key={d.deviceId}
                        onClick={() => {
                          setSelectedMicId(d.deviceId);
                          setShowMicList(false);
                        }}
                        selected={selectedMicId === d.deviceId}
                        sx={{ fontSize: '0.875rem' }}
                      >
                        {d.label || 'Default microphone'}
                      </MenuItem>
                    ))}
                  </Paper>
                )}
              </Box>
              <Box sx={{ position: 'relative' }}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowSpkList((v) => !v);
                    setShowMicList(false);
                  }}
                  title="Select speaker"
                  sx={{
                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.background.paper, 0.8),
                    },
                  }}
                >
                  <IconSpeaker fontSize="small" />
                </IconButton>
                {showSpkList && (
                  <Paper
                    elevation={8}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      zIndex: 10,
                      mt: 1,
                      width: 200,
                      maxHeight: 256,
                      overflow: 'auto',
                    }}
                  >
                    <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: 'text.secondary' }}>
                      Speakers
                    </Typography>
                    {audioOutputs.map((d) => (
                      <MenuItem
                        key={d.deviceId}
                        onClick={() => {
                          setSelectedSpeakerId(d.deviceId);
                          setShowSpkList(false);
                        }}
                        selected={selectedSpeakerId === d.deviceId}
                        sx={{ fontSize: '0.875rem' }}
                      >
                        {d.label || 'Default speakers'}
                      </MenuItem>
                    ))}
                  </Paper>
                )}
              </Box>
            </Box>

            {/* Phone Number Input with Country Code */}
            <Box sx={{ mt: 5, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <CountryCodeSelector
                value={countryCode}
                onChange={setCountryCode}
                size="small"
              />
              <TextField
                fullWidth
                label="To"
                placeholder="Phone number or SIP URI"
                value={toNumber}
                onChange={(e) => {
                  setToNumber(e.target.value);
                  setValidationError(null);
                  try {
                    storeSetToNumber(e.target.value);
                  } catch (_) {}
                }}
                error={!!validationError}
                helperText={validationError}
                size="small"
              />
            </Box>

            <FormControl fullWidth size="small">
              <InputLabel>From</InputLabel>
              <Select
                value={selectedFromNumber}
                label="From"
                onChange={(e) => setSelectedFromNumber(e.target.value)}
              >
                {availableNumbers.length === 0 ? (
                  <MenuItem value="">No numbers available</MenuItem>
                ) : (
                  availableNumbers.map((number) => (
                    <MenuItem key={number} value={number}>
                      {number}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <Box
              sx={{
                mt: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                placeItems: 'center',
                gap: 2,
                width: '100%',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <CircleButton
                  title={isMuted ? 'Unmute' : 'Mute'}
                  onClick={handleToggleMute}
                  disabled={!callRef.current}
                >
                  {isMuted ? <IconMicOff sx={{ fontSize: 20 }} /> : <IconMic sx={{ fontSize: 20 }} />}
                </CircleButton>
                <Typography variant="caption" fontSize="0.6875rem">
                  {isMuted ? 'Unmute' : 'Mute'}
                </Typography>
              </Box>

              {callRef.current ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <CircleButton title="End" color="error" onClick={handleHangup}>
                    <IconPhoneOff sx={{ fontSize: 20 }} />
                  </CircleButton>
                  <Typography variant="caption" fontSize="0.6875rem">
                    End
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <CircleButton title="Call" color="success" onClick={handleStartCall} disabled={!canCall}>
                    <IconPhone sx={{ fontSize: 20 }} />
                  </CircleButton>
                  <Typography variant="caption" fontSize="0.6875rem">
                    Call
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <CircleButton
                  title={callStatus?.toLowerCase() === 'held' ? 'Unhold' : 'Hold'}
                  onClick={handleToggleHold}
                  disabled={!callRef.current}
                >
                  {String(callStatus || '').toLowerCase() === 'held' ? (
                    <IconPlay sx={{ fontSize: 20 }} />
                  ) : (
                    <IconPause sx={{ fontSize: 20 }} />
                  )}
                </CircleButton>
                <Typography variant="caption" fontSize="0.6875rem">
                  {String(callStatus || '').toLowerCase() === 'held' ? 'Unhold' : 'Hold'}
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ width: '100%', my: 1 }} />

            <Button
              fullWidth
              onClick={() => setShowDtmf((v) => !v)}
              title="DTMF"
              sx={{
                justifyContent: 'space-between',
                px: 1,
                py: 0.5,
                fontSize: '0.6875rem',
                color: 'text.secondary',
                textTransform: 'none',
                '&:hover': {
                  color: 'text.primary',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconHash fontSize="small" sx={{ fontSize: '0.75rem' }} />
                <span>DTMF</span>
              </Box>
              <IconChevronDown
                sx={{
                  fontSize: '0.75rem',
                  transition: 'transform 0.2s',
                  transform: showDtmf ? 'rotate(180deg)' : 'none',
                }}
              />
            </Button>

            <Collapse in={showDtmf} timeout="auto">
              <Box
                sx={{
                  width: '100%',
                  borderRadius: 3,
                  bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
                  p: 2,
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    mb: 2,
                    minHeight: 22,
                    textAlign: 'center',
                    fontSize: '0.6875rem',
                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.3),
                    borderRadius: 1,
                    px: 2,
                    py: 0.5,
                    wordBreak: 'break-all',
                  }}
                >
                  {dtmfBuffer || '\u00A0'}
                </Paper>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 1.5,
                    mx: 6,
                  }}
                >
                  {keypadDigits.flat().map((digit) => (
                    <IconButton
                      key={digit}
                      onClick={() => handleKeypadDigit(digit)}
                      disabled={!isCallActive}
                      sx={{
                        width: 40,
                        height: 40,
                        fontSize: '1rem',
                        bgcolor: isCallActive
                          ? (theme) => alpha(theme.palette.background.paper, 0.8)
                          : (theme) => alpha(theme.palette.background.paper, 0.3),
                        color: 'text.primary',
                        boxShadow: 1,
                        '&:hover': {
                          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
                        },
                        '&:active': {
                          transform: 'scale(0.95)',
                        },
                        '&:disabled': {
                          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.3),
                          color: (theme) => alpha(theme.palette.text.primary, 0.3),
                        },
                      }}
                    >
                      {digit}
                    </IconButton>
                  ))}
                </Box>
              </Box>
            </Collapse>

            {/* Call Stats Section */}
            {isCallActive && (
              <>
                <Divider sx={{ width: '100%', my: 1 }} />

                <Button
                  fullWidth
                  onClick={() => setShowStats((v) => !v)}
                  title="Call Statistics"
                  sx={{
                    justifyContent: 'space-between',
                    px: 1,
                    py: 0.5,
                    fontSize: '0.6875rem',
                    color: 'text.secondary',
                    textTransform: 'none',
                    '&:hover': {
                      color: 'text.primary',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <IconStats fontSize="small" sx={{ fontSize: '0.75rem' }} />
                    <span>Call Stats</span>
                  </Box>
                  <IconChevronDown
                    sx={{
                      fontSize: '0.75rem',
                      transition: 'transform 0.2s',
                      transform: showStats ? 'rotate(180deg)' : 'none',
                    }}
                  />
                </Button>

                <Collapse in={showStats} timeout="auto">
                  <Box
                    sx={{
                      width: '100%',
                      borderRadius: 3,
                      bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
                      p: 2,
                    }}
                  >
                    {/* Call Duration */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        mb: 2,
                        py: 1,
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                        borderRadius: 2,
                      }}
                    >
                      <IconTimer sx={{ fontSize: '1rem', color: 'primary.main' }} />
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        {formatDuration(callDuration)}
                      </Typography>
                    </Box>

                    {/* Connection Quality Metrics */}
                    {callStats && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {/* Codec Information */}
                        {callStats.codec && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontSize="0.625rem">
                              Codec
                            </Typography>
                            <Typography variant="body2" fontSize="0.75rem" fontWeight={500}>
                              {callStats.codec.mimeType?.replace('audio/', '')} @ {callStats.codec.clockRate / 1000}kHz
                            </Typography>
                          </Box>
                        )}

                        {/* Packet Loss */}
                        {callStats.audio?.inbound && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontSize="0.625rem">
                              Packet Loss
                            </Typography>
                            <Typography
                              variant="body2"
                              fontSize="0.75rem"
                              fontWeight={500}
                              sx={{
                                color: parseFloat(getPacketLossPercent()) > 1 ? 'error.main' : 'success.main',
                              }}
                            >
                              {getPacketLossPercent()}% ({callStats.audio.inbound.packetsLost || 0} lost)
                            </Typography>
                          </Box>
                        )}

                        {/* Jitter */}
                        {callStats.audio?.inbound?.jitter && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontSize="0.625rem">
                              Jitter
                            </Typography>
                            <Typography variant="body2" fontSize="0.75rem" fontWeight={500}>
                              {callStats.audio.inbound.jitter} ms
                            </Typography>
                          </Box>
                        )}

                        {/* Round Trip Time */}
                        {callStats.connection?.currentRoundTripTime && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontSize="0.625rem">
                              Round Trip Time
                            </Typography>
                            <Typography
                              variant="body2"
                              fontSize="0.75rem"
                              fontWeight={500}
                              sx={{
                                color:
                                  parseFloat(callStats.connection.currentRoundTripTime) > 150
                                    ? 'error.main'
                                    : parseFloat(callStats.connection.currentRoundTripTime) > 100
                                    ? 'warning.main'
                                    : 'success.main',
                              }}
                            >
                              {callStats.connection.currentRoundTripTime} ms
                            </Typography>
                          </Box>
                        )}

                        {/* Data Transfer */}
                        {callStats.audio && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontSize="0.625rem">
                              Data Transfer
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, fontSize: '0.75rem' }}>
                              <Typography variant="body2" fontSize="0.75rem">
                                ↓ {((callStats.audio.inbound?.bytesReceived || 0) / 1024).toFixed(1)} KB
                              </Typography>
                              <Typography variant="body2" fontSize="0.75rem">
                                ↑ {((callStats.audio.outbound?.bytesSent || 0) / 1024).toFixed(1)} KB
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* Bitrate */}
                        {callStats.connection?.availableOutgoingBitrate && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" fontSize="0.625rem">
                              Available Bitrate
                            </Typography>
                            <Typography variant="body2" fontSize="0.75rem" fontWeight={500}>
                              {(callStats.connection.availableOutgoingBitrate / 1000).toFixed(0)} kbps
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

                    {!callStats && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textAlign: 'center', display: 'block', py: 1 }}
                      >
                        Gathering statistics...
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              </>
            )}
          </Box>
          </Paper>
        </Box>
      </Draggable>
    </Box>
  );

  try {
    return ReactDOM.createPortal(modalContent, portalTarget);
  } catch (error) {
    console.error('Portal creation failed:', error);
    return null;
  }
}

export default Softphone;
