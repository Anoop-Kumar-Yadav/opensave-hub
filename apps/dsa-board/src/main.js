// 1. Register all Data Structure plugins first
import './ds/index.js';

// 2. Import core store, engine, interaction, and UI controllers
import { store } from './core/store.js';
import { initRenderer } from './engine/renderer.js';
import { initToolbar } from './ui/toolbar.js';
import { initDSSidebar } from './ui/dsSidebar.js';
import { initInspectorSidebar } from './ui/inspectorSidebar.js';
import { initContextMenu } from './ui/contextMenu.js';
import { initBubblePalette } from './ui/bubblePalette.js';
import { initInteraction } from './tools/interaction.js';

// 3. Bootstrap application
const canvasEl = document.querySelector('#cv');
const wrapperEl = document.querySelector('#w');

store.init();
initRenderer(canvasEl, wrapperEl);
initToolbar();
initDSSidebar();
initInspectorSidebar();
initContextMenu(canvasEl);
initBubblePalette();
initInteraction(canvasEl);
