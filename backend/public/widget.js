(function () {
  'use strict';

  var SCRIPT = document.currentScript;
  var TOKEN = SCRIPT && SCRIPT.getAttribute('data-token');
  var API = (SCRIPT && SCRIPT.getAttribute('data-host')) || window.location.origin;
  var PRIMARY = SCRIPT && SCRIPT.getAttribute('data-color') || '#2563eb';

  if (!TOKEN) {
    console.error('[ChatWidget] Missing data-token attribute');
    return;
  }

  var VISITOR_ID = getVisitorId();
  var conversationId = null;
  var botName = 'Chat';

  // ── Visitor ID persistence ──
  function generateSecureId() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    // Fallback for very old browsers
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function getVisitorId() {
    var key = 'cw_visitor_' + TOKEN;
    var id = localStorage.getItem(key);
    if (!id) {
      id = 'v_' + generateSecureId();
      localStorage.setItem(key, id);
    }
    return id;
  }

  // ── Styles ──
  var css = '\
    #cw-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.5;position:fixed;bottom:20px;right:20px;z-index:2147483647}\
    #cw-toggle{width:56px;height:56px;border-radius:50%;background:' + PRIMARY + ';border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center;transition:transform .2s}\
    #cw-toggle:hover{transform:scale(1.08)}\
    #cw-toggle svg{width:26px;height:26px;fill:#fff}\
    #cw-panel{display:none;position:absolute;bottom:68px;right:0;width:380px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 100px);background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.12);flex-direction:column;overflow:hidden;border:1px solid #e5e7eb}\
    #cw-panel.open{display:flex}\
    #cw-header{padding:16px 18px;background:' + PRIMARY + ';color:#fff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}\
    #cw-header h3{margin:0;font-size:15px;font-weight:600}\
    #cw-close{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;opacity:.8;line-height:1}\
    #cw-close:hover{opacity:1}\
    #cw-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}\
    .cw-msg{max-width:82%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}\
    .cw-msg.user{align-self:flex-end;background:' + PRIMARY + ';color:#fff;border-bottom-right-radius:4px}\
    .cw-msg.assistant{align-self:flex-start;background:#f3f4f6;color:#1f2937;border-bottom-left-radius:4px}\
    .cw-msg.typing{align-self:flex-start;background:#f3f4f6;color:#9ca3af;font-style:italic}\
    #cw-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;flex-shrink:0;background:#fff}\
    #cw-input{flex:1;border:1px solid #d1d5db;border-radius:10px;padding:8px 14px;font-size:13px;outline:none;font-family:inherit}\
    #cw-input:focus{border-color:' + PRIMARY + ';box-shadow:0 0 0 2px ' + PRIMARY + '33}\
    #cw-send{background:' + PRIMARY + ';color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}\
    #cw-send:disabled{opacity:.5;cursor:default}\
    #cw-greeting{text-align:center;color:#9ca3af;padding:40px 20px;font-size:13px}\
    #cw-branding{text-align:center;padding:4px;font-size:10px;color:#d1d5db;flex-shrink:0}\
  ';

  // ── DOM ──
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.id = 'cw-root';
  root.innerHTML = '\
    <div id="cw-panel" role="dialog" aria-label="Chat widget">\
      <div id="cw-header">\
        <h3 id="cw-title">' + escapeHtml(botName) + '</h3>\
        <button id="cw-close" aria-label="Close chat">&times;</button>\
      </div>\
      <div id="cw-messages">\
        <div id="cw-greeting">Send a message to start chatting.</div>\
      </div>\
      <form id="cw-form">\
        <input id="cw-input" type="text" placeholder="Type a message..." autocomplete="off" aria-label="Type a message" />\
        <button id="cw-send" type="submit" aria-label="Send message">Send</button>\
      </form>\
      <div id="cw-branding">Powered by SaaS Platform</div>\
    </div>\
    <button id="cw-toggle" aria-label="Open chat">\
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>\
    </button>';
  document.body.appendChild(root);

  var panel = document.getElementById('cw-panel');
  var toggle = document.getElementById('cw-toggle');
  var closeBtn = document.getElementById('cw-close');
  var messagesEl = document.getElementById('cw-messages');
  var greeting = document.getElementById('cw-greeting');
  var form = document.getElementById('cw-form');
  var input = document.getElementById('cw-input');
  var sendBtn = document.getElementById('cw-send');
  var titleEl = document.getElementById('cw-title');
  var sending = false;

  toggle.addEventListener('click', function () {
    var open = panel.classList.toggle('open');
    toggle.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (open) input.focus();
  });

  closeBtn.addEventListener('click', function () {
    panel.classList.remove('open');
  });

  // ── Fetch bot name ──
  // Note: TOKEN is a public token intentionally exposed in the script tag (data-token).
  // It identifies the chatbot publicly and is not a secret credential.
  fetch(API + '/api/widget/config?token=' + encodeURIComponent(TOKEN))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.name) {
        botName = data.name;
        titleEl.textContent = botName;
      }
    })
    .catch(function () {});

  // ── Send message ──
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || sending) return;

    if (greeting) {
      greeting.remove();
    }

    appendMessage('user', text);
    input.value = '';
    sending = true;
    sendBtn.disabled = true;

    var typingEl = appendMessage('typing', 'Thinking...');

    fetch(API + '/api/widget/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: TOKEN,
        visitorId: VISITOR_ID,
        message: text,
        conversationId: conversationId || undefined,
      }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed');
        return r.json();
      })
      .then(function (data) {
        typingEl.remove();
        conversationId = data.conversationId;
        appendMessage('assistant', data.reply);
      })
      .catch(function () {
        typingEl.remove();
        appendMessage('assistant', 'Sorry, something went wrong. Please try again.');
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = false;
        input.focus();
      });
  });

  function appendMessage(role, text) {
    var div = document.createElement('div');
    div.className = 'cw-msg ' + role;
    // escapeHtml is used for both user and assistant messages to prevent XSS
    div.innerHTML = escapeHtml(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
