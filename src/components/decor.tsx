export function Decor() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden text-faint"
      aria-hidden="true"
    >
      <Moon className="absolute top-6 right-6 w-20 opacity-50 md:top-10 md:right-12 md:w-28" />
      <Moon className="absolute top-36 -left-6 w-14 opacity-25 md:top-44 md:left-8 md:w-16" />
      <Scissors className="absolute right-8 bottom-24 w-16 rotate-12 opacity-40 md:right-16 md:bottom-20 md:w-20" />
      <Scissors className="absolute top-1/2 -left-2 w-12 -rotate-45 opacity-20 md:left-6" />
      <Paw className="absolute top-24 left-10 w-8 -rotate-12 opacity-35 md:left-20" />
      <Paw className="absolute top-36 left-20 w-7 rotate-12 opacity-30 md:left-32" />
      <Paw className="absolute right-24 bottom-40 w-8 -rotate-6 opacity-30" />
      <Paw className="absolute right-14 bottom-52 w-6 rotate-12 opacity-25" />
      <Paw className="absolute bottom-16 left-1/3 w-7 -rotate-12 opacity-25" />
      <Paw className="absolute top-1/2 right-1/4 w-5 rotate-6 opacity-20" />
    </div>
  );
}

function Moon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M42 8c-8 4-14 13-14 24 0 14 10 26 24 26 2 0 5 0 7-1-5 5-12 8-19 8C22 65 8 51 8 32 8 14 22 1 40 1c3 0 6 .4 9 1-2 2-5 4-7 6Z" />
    </svg>
  );
}

function Paw({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="16" cy="22" rx="7" ry="5.5" />
      <circle cx="7.5" cy="13.5" r="3" />
      <circle cx="13" cy="8.5" r="3.1" />
      <circle cx="20" cy="8.5" r="3.1" />
      <circle cx="25.2" cy="13.5" r="3" />
    </svg>
  );
}

function Scissors({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="14" cy="16" r="7" />
      <circle cx="14" cy="48" r="7" />
      <path d="M19 20 L52 44" />
      <path d="M19 44 L52 20" />
      <path d="M52 20 L58 16" />
      <path d="M52 44 L58 48" />
    </svg>
  );
}
