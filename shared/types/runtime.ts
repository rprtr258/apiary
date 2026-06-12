export type Position = {
  x: number,
  y: number,
};

export type Size = {
  w: number,
  h: number,
};

export type Screen = {
  isCurrent: boolean,
  isPrimary: boolean,
  width: number,
  height: number,
};

// Environment information such as platform, buildtype, ...
export type EnvironmentInfo = {
  buildType: string,
  platform: string,
  arch: string,
};

// [LogPrint](https://wails.io/docs/reference/runtime/log#logprint)
// logs the given message as a raw message
export function LogPrint(message: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.LogPrint(message);
}

// [LogTrace](https://wails.io/docs/reference/runtime/log#logtrace)
// logs the given message at the `trace` log level.
export function LogTrace(message: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.LogTrace(message);
}

// [LogDebug](https://wails.io/docs/reference/runtime/log#logdebug)
// logs the given message at the `debug` log level.
export function LogDebug(message: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.LogDebug(message);
}

// [LogInfo](https://wails.io/docs/reference/runtime/log#loginfo)
// logs the given message at the `info` log level.
export function LogInfo(message: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.LogInfo(message);
}

// [LogWarning](https://wails.io/docs/reference/runtime/log#logwarning)
// logs the given message at the `warning` log level.
export function LogWarning(message: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.LogWarning(message);
}

// [LogError](https://wails.io/docs/reference/runtime/log#logerror)
// logs the given message at the `error` log level.
export function LogError(message: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.LogError(message);
}

// [LogFatal](https://wails.io/docs/reference/runtime/log#logfatal)
// logs the given message at the `fatal` log level.
// The application will quit after calling this method.
export function LogFatal(message: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.LogFatal(message);
}

// [EventsOnMultiple](https://wails.io/docs/reference/runtime/events#eventsonmultiple)
// sets up a listener for the given event name, but will only trigger a given number times.
export function EventsOnMultiple(eventName: string, callback: (...data: unknown[]) => void, maxCallbacks: number): () => void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.EventsOnMultiple(eventName, callback, maxCallbacks);
}

// [EventsOn](https://wails.io/docs/reference/runtime/events#eventson) sets up a listener for the given event name.
export function EventsOn(eventName: string, callback: (...data: unknown[]) => void): () => void {
  return EventsOnMultiple(eventName, callback, -1);
}

// [EventsOff](https://wails.io/docs/reference/runtime/events#eventsoff)
// unregisters the listener for the given event name.
export function EventsOff(eventName: string, ...additionalEventNames: string[]): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.EventsOff(eventName, ...additionalEventNames);
}

// [EventsOffAll](https://wails.io/docs/reference/runtime/events#eventsoffall)
// unregisters all listeners.
export function EventsOffAll(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.EventsOffAll();
}

// [EventsOnce](https://wails.io/docs/reference/runtime/events#eventsonce)
// sets up a listener for the given event name, but will only trigger once.
export function EventsOnce(eventName: string, callback: (...data: unknown[]) => void): () => void {
  return EventsOnMultiple(eventName, callback, 1);
}

// [EventsEmit](https://wails.io/docs/reference/runtime/events#eventsemit)
// emits the given event. Optional data may be passed with the event.
// This will trigger any event listeners.
export function EventsEmit(eventName: string, ...data: unknown[]): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.EventsEmit(eventName, data);
}

// [WindowReload](https://wails.io/docs/reference/runtime/window#windowreload)
// Forces a reload by the main application as well as connected browsers.
export function WindowReload(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowReload();
}

// [WindowReloadApp](https://wails.io/docs/reference/runtime/window#windowreloadapp)
// Reloads the application frontend.
export function WindowReloadApp(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowReloadApp();
}

// [WindowSetAlwaysOnTop](https://wails.io/docs/reference/runtime/window#windowsetalwaysontop)
// Sets the window AlwaysOnTop or not on top.
export function WindowSetAlwaysOnTop(b: boolean): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetAlwaysOnTop(b);
}

// [WindowSetSystemDefaultTheme](https://wails.io/docs/next/reference/runtime/window#windowsetsystemdefaulttheme)
// *Windows only*
// Sets window theme to system default (dark/light).
export function WindowSetSystemDefaultTheme(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetSystemDefaultTheme();
}

// [WindowSetLightTheme](https://wails.io/docs/next/reference/runtime/window#windowsetlighttheme)
// *Windows only*
// Sets window to light theme.
export function WindowSetLightTheme(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetLightTheme();
}

// [WindowSetDarkTheme](https://wails.io/docs/next/reference/runtime/window#windowsetdarktheme)
// *Windows only*
// Sets window to dark theme.
export function WindowSetDarkTheme(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetDarkTheme();
}

// [WindowCenter](https://wails.io/docs/reference/runtime/window#windowcenter)
// Centers the window on the monitor the window is currently on.
export function WindowCenter(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowCenter();
}

// [WindowSetTitle](https://wails.io/docs/reference/runtime/window#windowsettitle)
// Sets the text in the window title bar.
export function WindowSetTitle(title: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetTitle(title);
}

// [WindowFullscreen](https://wails.io/docs/reference/runtime/window#windowfullscreen)
// Makes the window full screen.
export function WindowFullscreen(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowFullscreen();
}

// [WindowUnfullscreen](https://wails.io/docs/reference/runtime/window#windowunfullscreen)
// Restores the previous window dimensions and position prior to full screen.
export function WindowUnfullscreen(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowUnfullscreen();
}


// [WindowIsFullscreen](https://wails.io/docs/reference/runtime/window#windowisfullscreen)
// Returns the state of the window, i.e. whether the window is in full screen mode or not.
export function WindowIsFullscreen(): Promise<boolean> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.WindowIsFullscreen();
}

// [WindowGetSize](https://wails.io/docs/reference/runtime/window#windowgetsize)
// Gets the width and height of the window.
export function WindowGetSize(): Promise<Size> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.WindowGetSize();
}

// [WindowSetSize](https://wails.io/docs/reference/runtime/window#windowsetsize)
// Sets the width and height of the window.
export function WindowSetSize(width: number, height: number): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetSize(width, height);
}

// [WindowSetMaxSize](https://wails.io/docs/reference/runtime/window#windowsetmaxsize)
// Sets the maximum window size. Will resize the window if the window is currently larger than the given dimensions.
// Setting a size of 0,0 will disable this constraint.
export function WindowSetMaxSize(width: number, height: number): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetMaxSize(width, height);
}

// [WindowSetMinSize](https://wails.io/docs/reference/runtime/window#windowsetminsize)
// Sets the minimum window size. Will resize the window if the window is currently smaller than the given dimensions.
// Setting a size of 0,0 will disable this constraint.
export function WindowSetMinSize(width: number, height: number): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetMinSize(width, height);
}

// [WindowSetPosition](https://wails.io/docs/reference/runtime/window#windowsetposition)
// Sets the window position relative to the monitor the window is currently on.
export function WindowSetPosition(x: number, y: number): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetPosition(x, y);
}

// [WindowGetPosition](https://wails.io/docs/reference/runtime/window#windowgetposition)
// Gets the window position relative to the monitor the window is currently on.
export function WindowGetPosition(): Promise<Position> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.WindowGetPosition();
}

// [WindowHide](https://wails.io/docs/reference/runtime/window#windowhide)
// Hides the window.
export function WindowHide(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowHide();
}

// [WindowShow](https://wails.io/docs/reference/runtime/window#windowshow)
// Shows the window, if it is currently hidden.
export function WindowShow(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowShow();
}

// [WindowMaximise](https://wails.io/docs/reference/runtime/window#windowmaximise)
// Maximises the window to fill the screen.
export function WindowMaximise(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowMaximise();
}

// [WindowToggleMaximise](https://wails.io/docs/reference/runtime/window#windowtogglemaximise)
// Toggles between Maximised and UnMaximised.
export function WindowToggleMaximise(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowToggleMaximise();
}

// [WindowUnmaximise](https://wails.io/docs/reference/runtime/window#windowunmaximise)
// Restores the window to the dimensions and position prior to maximising.
export function WindowUnmaximise(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowUnmaximise();
}

// [WindowIsMaximised](https://wails.io/docs/reference/runtime/window#windowismaximised)
// Returns the state of the window, i.e. whether the window is maximised or not.
export function WindowIsMaximised(): Promise<boolean> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.WindowIsMaximised();
}

// [WindowMinimise](https://wails.io/docs/reference/runtime/window#windowminimise)
// Minimises the window.
export function WindowMinimise(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowMinimise();
}

// [WindowUnminimise](https://wails.io/docs/reference/runtime/window#windowunminimise)
// Restores the window to the dimensions and position prior to minimising.
export function WindowUnminimise(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowUnminimise();
}

// [WindowSetBackgroundColour](https://wails.io/docs/reference/runtime/window#windowsetbackgroundcolour)
// Sets the background colour of the window to the given RGBA colour definition. This colour will show through for all transparent pixels.
export function WindowSetBackgroundColour(R: number, G: number, B: number, A: number): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.WindowSetBackgroundColour(R, G, B, A);
}

// [ScreenGetAll](https://wails.io/docs/reference/runtime/window#screengetall)
// Gets the all screens. Call this anew each time you want to refresh data from the underlying windowing system.
export function ScreenGetAll(): Promise<Screen[]> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.ScreenGetAll();
}

// [WindowIsMinimised](https://wails.io/docs/reference/runtime/window#windowisminimised)
// Returns the state of the window, i.e. whether the window is minimised or not.
export function WindowIsMinimised(): Promise<boolean> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.WindowIsMinimised();
}

// [WindowIsNormal](https://wails.io/docs/reference/runtime/window#windowisnormal)
// Returns the state of the window, i.e. whether the window is normal or not.
export function WindowIsNormal(): Promise<boolean> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.WindowIsNormal();
}

// [BrowserOpenURL](https://wails.io/docs/reference/runtime/browser#browseropenurl)
// Opens the given URL in the system browser.
export function BrowserOpenURL(url: string): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.BrowserOpenURL(url);
}

// [Environment](https://wails.io/docs/reference/runtime/intro#environment)
// Returns information about the environment
export function Environment(): Promise<EnvironmentInfo> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.Environment();
}

// [Quit](https://wails.io/docs/reference/runtime/intro#quit)
// Quits the application.
export function Quit(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.Quit();
}

// [Hide](https://wails.io/docs/reference/runtime/intro#hide)
// Hides the application.
export function Hide(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.Hide();
}

// [Show](https://wails.io/docs/reference/runtime/intro#show)
// Shows the application.
export function Show(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  window.runtime.Show();
}

// [ClipboardGetText](https://wails.io/docs/reference/runtime/clipboard#clipboardgettext)
// Returns the current text stored on clipboard
export function ClipboardGetText(): Promise<string> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.ClipboardGetText();
}

// [ClipboardSetText](https://wails.io/docs/reference/runtime/clipboard#clipboardsettext)
// Sets a text on the clipboard
export function ClipboardSetText(text: string): Promise<boolean> {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.ClipboardSetText(text);
}

/**
 * Callback for OnFileDrop returns a slice of file path strings when a drop is finished.
 *
 * @export
 * @callback OnFileDropCallback
 * @param {number} x - x coordinate of the drop
 * @param {number} y - y coordinate of the drop
 * @param {string[]} paths - A list of file paths.
 */

/**
 * OnFileDrop listens to drag and drop events and calls the callback with the coordinates of the drop and an array of path strings.
 *
 * @export
 * @param {OnFileDropCallback} callback - Callback for OnFileDrop returns a slice of file path strings when a drop is finished.
 * @param {boolean} [useDropTarget=true] - Only call the callback when the drop finished on an element that has the drop target style. (--wails-drop-target)
 */
// [OnFileDrop](https://wails.io/docs/reference/runtime/draganddrop#onfiledrop)
export function OnFileDrop(
  callback: (x: number, y: number, paths: string[]) => void,
  useDropTarget: boolean,
): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.OnFileDrop(callback, useDropTarget);
}

// [OnFileDropOff](https://wails.io/docs/reference/runtime/draganddrop#dragandddropoff)
// OnFileDropOff removes the drag and drop listeners and handlers.
export function OnFileDropOff(): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.OnFileDropOff();
}

// Check if the file path resolver is available
export function CanResolveFilePaths(): boolean {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.CanResolveFilePaths();
}

// Resolves file paths for an array of files
export function ResolveFilePaths(files: File[]): void {
  //@ts-expect-error sosal
  //eslint-disable-next-line
  return window.runtime.ResolveFilePaths(files);
}