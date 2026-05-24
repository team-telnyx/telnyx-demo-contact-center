'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Floating banner that appears when Socket.IO disconnects.
 * Shows "Reconnecting..." with a spinner, auto-hides on reconnect.
 */
export default function ConnectionStatus(): React.ReactElement | null {
  const { connected } = useSocket();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!connected) {
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowBanner(false);
    }
  }, [connected]);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-tx-red text-tx-ti py-2 px-4 text-[13px] font-medium shadow-tx-lg"
        >
          <WifiOff className="w-4 h-4" />
          <span>Connection lost — reconnecting...</span>
          <RefreshCw className="w-4 h-4 animate-spin" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
