import React from 'react';
import {Composition} from 'remotion';
import {Title} from './Title';
import {Room} from './room/Room';

const ROOM = {"lines": [{"text": "Ye reel kisi editing app mein nahi bani.", "start": 0.8, "end": 3.352}, {"text": "Na koi editing app, na koi editor.", "start": 3.852, "end": 6.297}, {"text": "Aur sab poochte hain — tera secret kya hai?", "start": 6.847, "end": 9.297}, {"text": "Agar AI ko bas bolo, cool video bana do…", "start": 9.897, "end": 12.822}, {"text": "Toh milta hai bekaar result.", "start": 13.122, "end": 15.029}, {"text": "Aur ye milta hai, jab AI ko sahi tarike se sikhao.", "start": 15.629, "end": 18.997}, {"text": "Secret hai… CODE.", "start": 19.596, "end": 20.785}, {"text": "Camera, light, captions, music, sound — har frame code se.", "start": 21.385, "end": 24.959}, {"text": "Aur ye sab kiya, ek 15 saal ke founder ne.", "start": 25.559, "end": 28.414}, {"text": "Comment karo AI, aur main bataunga kaise.", "start": 28.964, "end": 31.644}], "total": 33.644};

export const Root: React.FC = () => (
  <>
    <Composition id="Title" component={Title} durationInFrames={90} fps={30} width={1080} height={1920}
      defaultProps={{words: ['BUILT', 'IN', '63 DAYS'], accent: '#7C4DFF'}} />
    <Composition id="Room" component={Room} durationInFrames={Math.ceil(ROOM.total * 30)} fps={30} width={1920} height={1080}
      defaultProps={ROOM} />
  </>
);
