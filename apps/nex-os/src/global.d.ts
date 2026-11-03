// Type declarations for YouTube IFrame API
interface Window {
  YT?: {
    Player: new (elementId: string, options: any) => any;
    PlayerState: {
      PLAYING: number;
      PAUSED: number;
      ENDED: number;
    };
  };
  onYouTubeIframeAPIReady?: () => void;
}

// Type declarations for NodeJS timer
declare namespace NodeJS {
  interface Timeout {}
}
