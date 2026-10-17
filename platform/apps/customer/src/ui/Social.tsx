/** The original app's social icons (Instagram, WhatsApp, YouTube, Play) as plain SVG. */
export function IgIcon({ gid }: { gid: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset=".05" stopColor="#fdf497" />
          <stop offset=".45" stopColor="#fd5949" />
          <stop offset=".6" stopColor="#d6249f" />
          <stop offset="1" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gid})`} />
      <rect x="11" y="11" width="26" height="26" rx="8" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="24" cy="24" r="7" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="34.5" cy="13.5" r="1.8" fill="#fff" />
    </svg>
  );
}
export function WaIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#25D366" />
      <path
        d="M24 11c-7.2 0-13 5.8-13 13 0 2.3.6 4.5 1.7 6.5L11 37l6.7-1.8c1.9 1 4 1.6 6.3 1.6 7.2 0 13-5.8 13-13S31.2 11 24 11z"
        fill="#fff"
      />
      <path
        d="M19.3 17.9c-.3-.7-.6-.7-.9-.7h-.7c-.3 0-.7.1-1 .5-.3.4-1.3 1.3-1.3 3.1s1.3 3.6 1.5 3.9c.2.3 2.6 4.1 6.5 5.7 3.2 1.3 3.9 1.1 4.6 1 .7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.1-.2-.4-.3-.8-.5-.4-.2-2.2-1.1-2.6-1.2-.3-.1-.6-.2-.9.2-.3.4-1 1.2-1.2 1.5-.2.3-.4.3-.8.1-.4-.2-1.6-.6-3-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.2-.8.2-.2.4-.4.5-.7.2-.2.2-.4.4-.7.1-.2 0-.5 0-.7 0-.2-.9-2.2-1.2-2.9z"
        fill="#25D366"
      />
    </svg>
  );
}
export function YtIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="13" fill="#FF0000" />
      <path d="M19 16.5v15l14-7.5z" fill="#fff" />
    </svg>
  );
}
export function PlayIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M9 5 L9 43 L20 24 Z" fill="#00D2FF" />
      <path d="M9 5 L31 24 L20 24 Z" fill="#00F076" />
      <path d="M9 43 L31 24 L20 24 Z" fill="#FF3A44" />
      <path d="M31 24 L38 20 L38 28 Z" fill="#FFCE00" />
    </svg>
  );
}
export const LINKS = {
  ig: 'https://www.instagram.com/roz.bazaar/',
  wa: 'https://whatsapp.com/channel/0029VbDZkjc17EmskgnpXy2B',
  yt: 'https://www.youtube.com/@vedanshurathi2820',
  founder: 'https://www.instagram.com/vedanshu.rathi/',
  kishan: 'https://play.google.com/store/apps/details?id=app.kishanai.android&pcampaignid=web_share',
};
