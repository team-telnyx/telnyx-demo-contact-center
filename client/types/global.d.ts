// Type declarations for CSS module imports
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Type declarations for audio assets
declare module '*.mp3' {
  const src: string;
  export default src;
}

declare module '*.wav' {
  const src: string;
  export default src;
}
