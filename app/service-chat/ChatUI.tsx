import type { ReactNode, SVGProps } from "react";
import ui from "./chat-ui.module.css";
import type { Tone } from "./presentation";

/* =========================================================
   MY SERVICE: SMALL PRESENTATIONAL PIECES (no hooks)

   Icons follow components/SiteIcons: 24px viewBox, currentColor
   stroke, decorative by default. Reuse CheckIcon, ArrowIcon,
   CopyIcon, MessageIcon, CartIcon and ShieldIcon from SiteIcons.
========================================================= */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Icon>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4h10v16l-5-3.5L7 20Z" />
    </Icon>
  );
}

export function StatusChip({
  tone,
  label,
  size,
  surface,
  pulse,
  title,
  className,
}: {
  tone: Tone;
  label: string;
  size?: "lg";
  surface?: "forest";
  pulse?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <span
      className={className ? `${ui.chip} ${className}` : ui.chip}
      data-tone={tone}
      data-size={size}
      data-surface={surface}
      data-pulse={pulse ? "" : undefined}
      title={title}
    >
      {label}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={className ? `${ui.spinner} ${className}` : ui.spinner}
      aria-hidden="true"
    />
  );
}
