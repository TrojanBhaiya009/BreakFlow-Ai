function SvgIcon({ size = 24, className = '', children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconCode(props) {
  return (
    <SvgIcon {...props}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </SvgIcon>
  );
}

export function IconCheck(props) {
  return (
    <SvgIcon {...props} strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </SvgIcon>
  );
}

export function IconArrowRight(props) {
  return (
    <SvgIcon {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </SvgIcon>
  );
}

export function IconArrowLeft(props) {
  return (
    <SvgIcon {...props}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </SvgIcon>
  );
}

export function IconGlobe(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </SvgIcon>
  );
}

export function IconClock(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </SvgIcon>
  );
}

export function IconTerminal(props) {
  return (
    <SvgIcon {...props}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </SvgIcon>
  );
}

export function IconLoader({ style, ...props }) {
  return (
    <SvgIcon
      {...props}
      style={{ animation: 'spin 0.7s linear infinite', ...style }}
    >
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" opacity="0.3" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" opacity="0.9" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" opacity="0.2" />
      <line x1="2" y1="12" x2="6" y2="12" opacity="0.7" />
      <line x1="18" y1="12" x2="22" y2="12" opacity="0.4" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" opacity="0.5" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" opacity="0.6" />
    </SvgIcon>
  );
}

export function IconChevronDown(props) {
  return (
    <SvgIcon {...props}>
      <polyline points="6 9 12 15 18 9" />
    </SvgIcon>
  );
}

export function IconChevronRight(props) {
  return (
    <SvgIcon {...props}>
      <polyline points="9 18 15 12 9 6" />
    </SvgIcon>
  );
}
