export const overlayMotionClass =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-300";

export const glassOverlayClass =
  "bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_rgba(15,23,42,0.12)_34%,_rgba(15,23,42,0.48)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.14),_rgba(2,6,23,0.38)_34%,_rgba(2,6,23,0.78)_100%)] backdrop-blur-md";

export const glassPanelSurfaceClass =
  "border border-white/45 dark:border-white/10 bg-white/74 dark:bg-[#050816]/78 supports-[backdrop-filter]:bg-white/68 dark:supports-[backdrop-filter]:bg-[#050816]/72 backdrop-blur-3xl shadow-[0_24px_80px_rgba(15,23,42,0.16)] dark:shadow-[0_28px_90px_rgba(2,6,23,0.6)]";

export const dialogPanelMotionClass =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-300";

export const sheetPanelMotionClass =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:duration-300 data-[state=open]:duration-300";

export const windowShellTransitionClass =
  "transition-[transform,opacity,filter,box-shadow,background-color,border-color] duration-300 ease-out will-change-transform";

export const panelSpring = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 0.95,
} as const;

export const navSpring = {
  type: "spring",
  bounce: 0.18,
  duration: 0.55,
} as const;

export const contentFadeVariants = {
  initial: { opacity: 0, filter: "blur(10px)", scale: 0.985, y: 10 },
  animate: { opacity: 1, filter: "blur(0px)", scale: 1, y: 0 },
  exit: { opacity: 0, filter: "blur(8px)", scale: 0.99, y: 8 },
} as const;

export const desktopTabPanelVariants = {
  active: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    pointerEvents: "auto",
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  inactive: {
    opacity: 0,
    y: 10,
    scale: 0.992,
    filter: "blur(8px)",
    pointerEvents: "none",
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 0.2, 1],
    },
  },
} as const;
