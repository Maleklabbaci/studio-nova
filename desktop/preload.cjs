'use strict'

/**
 * The thin bridge between the frameless window and the app's own title bar.
 * The renderer gets window controls and nothing else: no Node, no filesystem,
 * no arbitrary IPC. Channel names are fixed and every payload is a boolean.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('studioNovaDesktop', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('studio-nova:window-minimize'),
  toggleMaximize: () => ipcRenderer.send('studio-nova:window-toggle-maximize'),
  close: () => ipcRenderer.send('studio-nova:window-close'),
  isMaximized: () => ipcRenderer.invoke('studio-nova:window-is-maximized'),
  onMaximizedChange: (callback) => {
    const listener = (_event, maximized) => callback(Boolean(maximized))
    ipcRenderer.on('studio-nova:window-maximized-changed', listener)
    return () => ipcRenderer.removeListener('studio-nova:window-maximized-changed', listener)
  },
})
