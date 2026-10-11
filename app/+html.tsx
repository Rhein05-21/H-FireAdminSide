import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering with Expo Router.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* Apple iOS PWA Fullscreen Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="H-Fire Admin" />

        {/* General PWA Meta */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0B0F19" />
        <meta name="application-name" content="H-Fire Admin" />
        <meta name="description" content="Community Fire Safety & Sensor Monitoring System" />

        <link rel="apple-touch-icon" href="/h-fire_logo.png" />
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />
      </head>
      <body style={{ backgroundColor: '#0B0F19', margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
