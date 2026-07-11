// electron-squirrel-startup ships no types. It evaluates the Squirrel startup
// event on import and exposes whether one was handled (true => the app should quit).
declare module 'electron-squirrel-startup' {
  const startedViaSquirrelEvent: boolean;
  export default startedViaSquirrelEvent;
}
