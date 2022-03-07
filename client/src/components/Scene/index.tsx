import React, { useEffect, useRef, useState } from 'react';
import { customMouseEvent } from './customMouseEvent';
import './index.scss';
import useScene from './useScene';

export default function SceneComponnet() {
  const ref = useRef(null);
  const { sceneInfo, setBoxSelectionEnabled, boxSelectionEnabled } = useScene(ref);

  if (sceneInfo) {
    (window as any).s = sceneInfo;
  }

  useEffect(() => {
    customMouseEvent.onKey('Meta',
      (e) => {
        setBoxSelectionEnabled(true);
      },
      (e) => {
        setBoxSelectionEnabled(false);
      }
    );
  }, []);

  return <div style={{ height: '100%', width: '100%' }}>
    <button
      onClick={() => {
        setBoxSelectionEnabled(!boxSelectionEnabled);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      style={{ position: 'absolute', top: '20px', right: '20px' }}>box selection</button>
    <div id="scene" ref={ref}></div>
  </div>
}