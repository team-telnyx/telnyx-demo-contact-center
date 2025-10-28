# SE-Contact-Center V3 Release Notes

## Release Date
January 2025

## Overview
Version 3 represents a major upgrade to the SE-Contact-Center application, featuring a complete migration from React to Next.js 15, TypeScript conversion, enhanced call management capabilities, and real-time messaging improvements.

---

## Major Changes

### 1. Framework Migration
- **Migrated from React to Next.js 15.5.4**
  - Implemented App Router architecture
  - Server-side rendering for improved performance
  - Better code splitting and optimization
  - Enhanced routing and navigation

### 2. TypeScript Conversion
- **Complete TypeScript migration**
  - All components converted from .jsx to .tsx
  - Type-safe props and interfaces
  - Better IDE support and autocomplete
  - Reduced runtime errors

### 3. Enhanced Call Management

#### Transfer Functionality
- **Fixed transfer button visibility** (client/src/components/PhonePage.tsx:77-109)
  - Transfer button now appears for both inbound and outbound calls
  - Multi-source call state detection (CallManager, call-store)
  - Support for all call statuses: connected, ringing, dialing, holding, active

- **Improved transfer reliability** (client/src/components/PhonePage.tsx:168-238)
  - Automatic fallback to fetch active session from server
  - Correct Telnyx call control ID extraction
  - Proper agent leg identification

- **Fixed SIP username lookup** (server/routes/inboundVoiceRoutes.js:885-909)
  - Flexible lookup by sipUsername or username
  - Prevents "Invalid destination number" errors

#### Call Session Linking
- **Implemented Telnyx link_to and bridge_intent parameters**
  - Outbound WebRTC calls (server/routes/outboundVoiceRoutes.js:64-74)
  - Inbound queued calls (server/routes/inboundVoiceRoutes.js:563-571)
  - Transfer calls (server/routes/inboundVoiceRoutes.js:997-1011)
  - Ensures proper call session tracking and bridging

#### Database Improvements
- **Fixed foreign key constraint errors** (server/routes/inboundVoiceRoutes.js:762-858)
  - Proper sessionKey propagation from customer to agent legs
  - Three-level fallback strategy for finding correct session
  - Prevents SQLITE_CONSTRAINT errors during call bridging

### 4. Real-Time Communication

#### Server-Sent Events (SSE)
- **Migrated from WebSocket to SSE** (client/src/hooks/useServerSentEvents.ts)
  - More reliable real-time updates
  - Better error handling and reconnection
  - Reduced server overhead
  - Automatic event stream management

#### Messaging Improvements
- **Fixed disappearing conversations** (client/src/components/SmsPage.tsx:169-200)
  - Initial data fetch on component mount
  - Prevents blank screen during navigation
  - SSE continues to provide real-time updates

### 5. User Interface

#### Softphone Component
- **Fixed z-index blocking issues** (client/src/components/Softphone.tsx:669)
  - Reduced z-index to 1300 (MUI Dialog default)
  - Allows access to messaging during active calls
  - Better coexistence with other UI elements

#### Data Caching
- **Implemented DataCacheContext** (client/src/contexts/DataCacheContext.tsx)
  - Caches agent numbers and agent list
  - Reduces API calls
  - Faster page navigation
  - 5-minute cache expiration

### 6. Call Features

#### DTMF Support
- **Enhanced keypad functionality** (client/src/lib/dtmf.ts)
  - Audio feedback for DTMF tones
  - Visual buffer display
  - Proper tone generation using Web Audio API

#### Call Statistics
- **Real-time call quality metrics** (client/src/components/Softphone.tsx:543-640)
  - Packet loss percentage
  - Jitter measurements
  - Round trip time
  - Data transfer statistics
  - Codec information
  - Available bitrate

#### Phone Number Validation
- **International number support** (client/src/utils/phoneValidation.ts)
  - Country code selector
  - E.164 format validation
  - Support for 200+ countries
  - Visual country flags

---

## Technical Improvements

### Architecture
- **Modular route structure**
  - Separated inbound and outbound voice routes
  - Dedicated SSE routes
  - Better code organization

### State Management
- **Enhanced call state tracking**
  - Centralized call-store with pub-sub pattern (client/src/lib/call-store.ts)
  - Multiple state sources for reliability
  - Better synchronization between components

### Error Handling
- **Improved error recovery**
  - Graceful handling of Telnyx API errors
  - Better user feedback
  - Automatic retry mechanisms

---

## Bug Fixes

1. **Transfer button not showing** - Fixed multi-source call state detection
2. **Transfer API 404 errors** - Implemented server-side active session fallback
3. **Database foreign key constraints** - Fixed sessionKey propagation
4. **Invalid SIP destination** - Added flexible username lookup
5. **Softphone blocking UI** - Reduced z-index for better coexistence
6. **Disappearing conversations** - Added initial data fetch on mount
7. **Call control ID mismatch** - Proper extraction of Telnyx call control IDs

---

## New Features

1. **Country code selector** for international dialing
2. **Call statistics panel** with real-time quality metrics
3. **DTMF keypad** with audio feedback
4. **Data caching** for faster performance
5. **SSE-based real-time updates** replacing WebSocket
6. **Draggable softphone** window
7. **Call duration timer** with formatted display

---

## API Changes

### New Endpoints
- `GET /api/events/queue` - SSE endpoint for queue updates
- `GET /api/events/messages` - SSE endpoint for message updates
- `GET /api/voice/my-active-session` - Fetch current active call session

### Modified Endpoints
- `/api/voice/transfer` - Enhanced with proper SIP username lookup
- `/api/voice/accept-call` - Added link_to and bridge_intent parameters
- `/api/voice/outbound-webrtc` - Added link_to and bridge_intent parameters

---

## Database Schema Updates

### CallLeg Model
- Added `accepted_by` field for tracking which agent accepted
- Improved sessionKey foreign key handling
- Better status tracking

### CallSession Model
- Enhanced session lifecycle tracking
- Improved status management

---

## Dependencies

### New Dependencies
- Next.js 15.5.4
- TypeScript 5.x
- @telnyx/react-client
- Various type definition packages

### Updated Dependencies
- Material-UI (MUI) components
- Axios for HTTP requests
- Sequelize ORM

---

## Migration Guide from V2 to V3

### For Developers

1. **Update environment variables**
   - No changes required to existing .env files
   - Ensure NEXT_PUBLIC_ prefix for client-side variables

2. **Install dependencies**
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

3. **Run database migrations**
   - Database schema is backward compatible
   - Run `npm run seed` to ensure latest schema

4. **Start development servers**
   ```bash
   # Terminal 1 - Server
   cd server && npm start

   # Terminal 2 - Client
   cd client && npm run dev
   ```

### For Users

- No manual migration required
- All existing data is preserved
- Login credentials remain the same
- Enhanced UI with same functionality

---

## Known Issues

None reported at this time.

---

## Future Roadmap

- Enhanced analytics and reporting
- Call recording capabilities
- Advanced queue management features
- Mobile responsive design improvements
- Multi-tenant support

---

## Contributors

- Phillip Kujawa
- Claude AI Assistant

---

## Support

For issues or questions, please open an issue on GitHub:
https://github.com/yourusername/SE-Contact-Center/issues

---

## License

[Your License Here]
