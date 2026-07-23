import type { Metadata, Viewport } from 'next';
import { Outfit, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const plex = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex' });

export const metadata: Metadata = {
  title: 'GCHQ — Green Corridor Headquarters',
  description: 'Green Corridor Headquarters — Mass Casualty & Ambulance Routing Command System',
  icons: {
    icon: '/gchq-logo.png',
    apple: '/gchq-logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0f7a45',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${outfit.variable} ${plex.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
