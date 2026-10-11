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
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" 
        />

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

        {/* iOS Native Safe Area Insets & Momentum Touch Scrolling */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --sat: env(safe-area-inset-top, 0px);
            --sab: env(safe-area-inset-bottom, 0px);
            --sal: env(safe-area-inset-left, 0px);
            --sar: env(safe-area-inset-right, 0px);
          }

          html, body, #root {
            height: 100%;
            width: 100%;
            background-color: #0B0F19;
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -webkit-tap-highlight-color: transparent;
            overscroll-behavior-y: none;
          }

          body {
            padding-top: env(safe-area-inset-top, 0px);
            padding-bottom: env(safe-area-inset-bottom, 0px);
            padding-left: env(safe-area-inset-left, 0px);
            padding-right: env(safe-area-inset-right, 0px);
            box-sizing: border-box;
            -webkit-overflow-scrolling: touch;
          }
        `}} />
      </head>
      <body style={{ backgroundColor: '#0B0F19', margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
