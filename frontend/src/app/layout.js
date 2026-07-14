import './globals.css';

export const metadata = {
  title: 'BreakFlow - Browser Resilience Checks',
  description:
    'Failure-oriented browser checks for release candidates, staging builds, and production workflows.',
  keywords: 'browser testing, QA automation, resilience testing, workflow testing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
