// TODO: <NNotificationProvider :max="1" placement="bottom-right">
export default (() => {
  const notify = (args: Record<string, unknown>): void => {
    alert(Object.entries({title: "Error", ...args}).map(([k, arg]) => k+": "+String(arg)).join("\n"));
  };
  return {
    error: notify,
  };
})();
