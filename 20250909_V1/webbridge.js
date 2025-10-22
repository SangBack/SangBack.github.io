// webbridge.js
(function (global) {
  const GO_NAME   = 'WebBridge';        // Unity 씬에 있는 GameObject 이름
  const METHOD    = 'OnBrowserEvent';   // C# 메서드 이름
  const queue = [];

  function isReady(){
    return !!(global.unityInstance && global.unityInstance.SendMessage);
  }

  function _send(jsonStr){
    try {
      global.unityInstance.SendMessage(GO_NAME, METHOD, jsonStr);
    } catch (e) {
      console.warn('[WebBridge] SendMessage 실패:', e);
    }
  }

  function flush(){
    if (!isReady()) return;
    while (queue.length) _send(queue.shift());
  }

  function emit(type, payload){
    const msg = JSON.stringify({ type, payload });
    if (isReady()) _send(msg); else queue.push(msg);
  }

  // Unity 인스턴스가 준비된 뒤 flush
  function ready(){ flush(); }

  global.WebBridge = { emit, ready };
})(window);
