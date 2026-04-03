'use client';

import React, { useEffect, useId, useState } from 'react';

interface KalitLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
  color?: 'dark' | 'light' | 'gradient' | 'marketing';
  /** Use the marketing suite icon instead of the K mark */
  variant?: 'k-mark' | 'marketing-suite';
}

// The official Kalit "K" mark path from kalit.ai/favicon.svg
const KALIT_K_PATH =
  'M78.916 4.482c0 19.59-15.089 35.653-34.278 37.206 19.154 1.613 34.197 17.669 34.197 37.24H60.148c0-10.321-8.368-18.688-18.688-18.688s-18.687 8.368-18.688 18.688H4.083l.001-.074V4.177h18.688v42.376c5.497-3.18 11.88-5.001 18.688-5.001l.126.001v-18.61c10.196 0 18.461-8.265 18.461-18.461v-.41h18.87v.41z';

// The official Marketing Suite icon path from kalit.ai/favicon-marketing.svg
const MARKETING_SUITE_PATH =
  'M71.751 0C71.751 17.0534 57.9265 30.8779 40.873 30.8779C23.8196 30.8779 9.99512 17.0534 9.99512 0V81.9811M71.7665 36.1279L71.6221 81.9124';

/**
 * Kalit logo — supports both the K mark and the Marketing Suite icon
 * - dark: dark fill for light backgrounds
 * - light: white fill for dark backgrounds
 * - gradient: 4-color kalit gradient
 * - marketing: indigo marketing suite color (#2F44FF)
 */
export function KalitLogo({ size = 36, animate = true, color = 'light', variant = 'k-mark', className = '' }: KalitLogoProps) {
  const [visible, setVisible] = useState(!animate);
  const uid = useId().replace(/:/g, '_');
  const gradId = `kalit-grad-${uid}`;

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, [animate]);

  const isMarketingSuite = variant === 'marketing-suite';
  const isStroke = isMarketingSuite; // Marketing suite icon uses stroke, not fill

  const fills: Record<string, string> = {
    dark: '#13121f',
    light: '#f8fafc',
    gradient: `url(#${gradId})`,
    marketing: isMarketingSuite ? '#2F44FF' : `url(#${gradId})`,
  };

  const colorValue = fills[color] ?? '#f8fafc';

  return (
    <svg
      viewBox="0 0 82 82"
      width={size}
      height={size}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={isMarketingSuite ? 'Kalit Marketing Suite' : 'Kalit logo'}
    >
      {(color === 'gradient' || (color === 'marketing' && !isMarketingSuite)) && (
        <defs>
          <linearGradient id={gradId} x1="4" y1="4" x2="79" y2="79" gradientUnits="userSpaceOnUse">
            {color === 'marketing' ? (
              <>
                <stop offset="0%" stopColor="#818CF8" />
                <stop offset="50%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#C4B5FD" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#91e500" />
                <stop offset="33%" stopColor="#12bcff" />
                <stop offset="66%" stopColor="#2f44ff" />
                <stop offset="100%" stopColor="#8200df" />
              </>
            )}
          </linearGradient>
        </defs>
      )}

      <path
        d={isMarketingSuite ? MARKETING_SUITE_PATH : KALIT_K_PATH}
        {...(isStroke
          ? { stroke: colorValue, strokeWidth: 21, fill: 'none' }
          : { fill: colorValue }
        )}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.9)',
          transformOrigin: 'center',
          transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0, 1), transform 0.5s cubic-bezier(0.4, 0, 0, 1)',
        }}
      />
    </svg>
  );
}
