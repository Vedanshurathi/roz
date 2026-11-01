import React from 'react';
import {Composition} from 'remotion';
import {Title} from './Title';

// 1080x1920 @30fps vertical canvas for Reels / Shorts
export const Root: React.FC = () => (
  <Composition id="Title" component={Title} durationInFrames={90} fps={30} width={1080} height={1920}
    defaultProps={{words: ['BUILT', 'IN', '63 DAYS'], accent: '#7C4DFF'}} />
);
