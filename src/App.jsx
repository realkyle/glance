import { useState, useEffect, useRef, useCallback } from 'react';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are Glance — a real-time AI assistant embedded in the user's screen overlay.

First, identify the context type on its own line exactly as one of:
Mode: Code
Mode: Browser
Mode: Document
Mode: Terminal
Mode: Design
Mode: Other

Then give 2-4 concise bullet points (•) tailored to the context:
- Code (editor, IDE): bugs, code quality, specific improvements, potential issues
- Browser (web page, app): summarize content, highlight key info, suggest actions
- Document (Word, Google Docs, PDF, spreadsheet): key insights, next actions, anything needing attention
- Terminal (command line, shell output): explain output, identify errors, suggest next steps
- Design (Figma, etc.): UX feedback, visual hierarchy, specific improvements
- Other: general actionable suggestions

Be direct and specific. No fluff. No preamble.`;

const MODES = {
  Code:     { label: 'Code Review', color: '#10b981' },
  Browser:  { label: 'Web',         color: '#3b82f6' },
  Document: { label: 'Document',    color: '#f59e0b' },
  Terminal: { label: 'Terminal',    color: '#6b7280' },
  Design:   { label: 'Design',      color: '#ec4899' },
  Other:    { label: 'General',     color: 'rgb(139,92,246)' },
};

function parseMode(text) {
  const match = text.match(/^Mode:\s*(\w+)\s*\n?/);
  if (!match) return { mode: null, body: text };
  const key = match[1];
  return { mode: MODES[key] ? key : 'Other', body: text.slice(match[0].length).trimStart() };
}

function parseInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**'))
      return <strong key={i} style={{ color: 'rgba(255,255,255,0.98)', fontWeight: 700 }}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith('*') && seg.endsWith('*'))
      return <em key={i} style={{ color: 'rgba(255,255,255,0.85)' }}>{seg.slice(1, -1)}</em>;
    return seg;
  });
}

function GlanceLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* outer lens curve */}
      <path d="M2 12 C6 5, 18 5, 22 12 C18 19, 6 19, 2 12 Z" stroke="rgb(139,92,246)" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(139,92,246,0.08)" />
      {/* iris */}
      <circle cx="12" cy="12" r="3.8" stroke="rgb(139,92,246)" strokeWidth="1.4" fill="rgba(139,92,246,0.12)" />
      {/* pupil */}
      <circle cx="12" cy="12" r="1.6" fill="rgb(139,92,246)" />
      {/* specular highlight */}
      <circle cx="13.5" cy="10.5" r="0.7" fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(139,92,246,0.3)" strokeWidth="2.5" />
      <path d="M12 2 a10 10 0 0 1 10 10" stroke="rgb(139,92,246)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CaptureIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function RegionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon({ active }) {
  return active ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StreamingText({ text }) {
  const parts = text.split(/(\•[^\•\n]+)/g);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {parts.map((part, i) => {
        if (part.startsWith('•')) {
          return (
            <div key={i} className="flex gap-2 fade-in">
              <span style={{ color: 'rgb(139,92,246)', flexShrink: 0, marginTop: '1px' }}>•</span>
              <span style={{ color: 'rgba(255,255,255,0.88)', lineHeight: '1.55' }}>{parseInline(part.slice(1).trim())}</span>
            </div>
          );
        }
        if (part.trim()) {
          return (
            <p key={i} className="fade-in" style={{ color: 'rgba(255,255,255,0.75)', lineHeight: '1.55', margin: 0 }}>
              {parseInline(part)}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

// { role: 'user', text, screenshot? } | { role: 'assistant', text }
export default function App() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const streamRef = useRef('');
  const questionRef = useRef('');
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const sendToAPI = useCallback(async (msgs) => {
    if (!API_KEY) { setError('No API key. Add VITE_ANTHROPIC_API_KEY to .env'); return; }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError('');
    setStreaming('');
    streamRef.current = '';

    const apiMessages = msgs.map(m => ({
      role: m.role,
      content: m.role === 'user'
        ? [
            ...(m.screenshot ? [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: m.screenshot.split(',')[1] } }] : []),
            { type: 'text', text: m.text },
          ]
        : m.text,
    }));

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: abortRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          stream: true,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: apiMessages,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              streamRef.current += parsed.delta.text;
              setStreaming(streamRef.current);
            }
          } catch {}
        }
      }

      const { mode, body } = parseMode(streamRef.current);
      setMessages(prev => [...prev, { role: 'assistant', text: body, mode }]);
      setStreaming('');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  const addCapture = useCallback((dataUrl, questionText) => {
    const userMsg = {
      role: 'user',
      text: questionText?.trim() || 'What do you see? Give me real-time suggestions.',
      screenshot: dataUrl,
    };
    setMessages(prev => {
      const next = [...prev, userMsg];
      sendToAPI(next);
      return next;
    });
    setQuestion('');
    questionRef.current = '';
  }, [sendToAPI]);

  const handleCapture = useCallback(async () => {
    if (loading) return;
    try {
      const dataUrl = await window.electronAPI.requestScreenshot();
      addCapture(dataUrl, question);
    } catch (err) {
      setError(err.message || 'Screenshot failed');
    }
  }, [loading, question, addCapture]);

  const handleFollowup = useCallback(async (e) => {
    e.preventDefault();
    if (!question.trim() || loading || messages.length === 0) return;
    const userMsg = { role: 'user', text: question.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setQuestion('');
    await sendToAPI(next);
  }, [question, loading, messages, sendToAPI]);

  const toggleVoice = useCallback(async () => {
    if (isListening) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsListening(false);
        setIsTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('file', blob, 'audio.webm');
          formData.append('model', 'whisper-1');
          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: formData,
          });
          const data = await res.json();
          if (data.text) setQuestion(prev => prev ? prev + ' ' + data.text : data.text);
          else if (data.error) setError('Whisper: ' + data.error.message);
        } catch (err) {
          setError('Transcription failed: ' + err.message);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsListening(true);
    } catch {
      setError('Microphone access denied');
    }
  }, [isListening]);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    mediaRecorderRef.current?.stop();
    setMessages([]);
    setStreaming('');
    setError('');
    setLoading(false);
    setIsListening(false);
    setIsTranscribing(false);
  }, []);

  useEffect(() => {
    window.electronAPI?.onScreenshot((dataUrl) => addCapture(dataUrl, questionRef.current));
    window.electronAPI?.onScreenshotError((msg) => setError(msg));
  }, [addCapture]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const isEmpty = messages.length === 0 && !loading && !error;
  const hasMessages = messages.length > 0;

  if (isCollapsed) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(24px)',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0 14px',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      }}>
        <div
          onClick={() => { setIsCollapsed(false); window.electronAPI?.expandWindow(); }}
          title="Expand"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'rgba(139,92,246,0.15)',
            border: '1px solid rgba(139,92,246,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.28)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; }}
        >
          <GlanceLogo size={14} />
        </div>
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.01em' }}>
          Glance
        </span>
        {loading && <Spinner />}
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'rgba(10, 10, 15, 0.92)',
      backdropFilter: 'blur(24px)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
    }}>

      {/* Header */}
      <div style={{
        WebkitAppRegion: 'drag',
        padding: '14px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GlanceLogo />
          <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: '13px', letterSpacing: '0.01em' }}>
            Glance
          </span>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
              <Spinner />
              <span style={{ color: 'rgb(139,92,246)', fontSize: '11px', fontWeight: 500 }}>thinking…</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => { setIsCollapsed(true); window.electronAPI?.collapseWindow(); }}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', width: '22px', height: '22px', borderRadius: '50%', fontSize: '14px', lineHeight: 1, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="Collapse"
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          >−</button>
          <button
            onClick={() => window.electronAPI?.closeWindow()}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', width: '22px', height: '22px', borderRadius: '50%', fontSize: '12px', lineHeight: 1, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="Close"
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          >✕</button>
        </div>
      </div>

      {/* Capture buttons */}
      <div style={{ padding: '12px 16px 10px', flexShrink: 0, display: 'flex', gap: '8px' }}>
        <button
          className="btn-capture"
          onClick={handleCapture}
          disabled={loading}
          style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            border: '1px solid rgba(139,92,246,0.3)',
            background: loading ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.15)',
            color: loading ? 'rgba(139,92,246,0.4)' : 'rgb(196,167,255)',
            fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            transition: 'all 0.15s ease', WebkitAppRegion: 'no-drag',
          }}
        >
          <CaptureIcon />
          {loading ? 'Analyzing…' : 'Full Screen'}
        </button>
        <button
          onClick={() => !loading && window.electronAPI?.openRegionSelector()}
          disabled={loading}
          title="Select a region of the screen"
          style={{
            padding: '10px 12px', borderRadius: '10px',
            border: '1px solid rgba(139,92,246,0.3)',
            background: loading ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.1)',
            color: loading ? 'rgba(139,92,246,0.4)' : 'rgb(196,167,255)',
            fontSize: '12px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            whiteSpace: 'nowrap', transition: 'all 0.15s ease', WebkitAppRegion: 'no-drag',
          }}
        >
          <RegionIcon />
          Region
        </button>
      </div>

      {/* Chat thread */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 8px', minHeight: 0 }}>

        {/* Empty state */}
        {isEmpty && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Ask about anything on your screen</p>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11.5px' }}>Capture a screenshot to get started</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <kbd style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', padding: '2px 7px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'monospace' }}>Ctrl+Shift+Space</kbd>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>Full screen</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <kbd style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', padding: '2px 7px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'monospace' }}>Ctrl+Shift+D</kbd>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>Select a region</span>
              </div>
            </div>
          </div>
        )}

        {/* Message thread */}
        {messages.map((msg, i) => {
          if (msg.role === 'user') {
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', paddingLeft: '28px' }}>
                <div style={{
                  background: 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: '12px 12px 2px 12px',
                  overflow: 'hidden',
                  maxWidth: '100%',
                }}>
                  {msg.screenshot && (
                    <img
                      src={msg.screenshot}
                      alt="capture"
                      style={{ width: '100%', maxHeight: '72px', objectFit: 'cover', display: 'block', opacity: 0.7 }}
                    />
                  )}
                  <p style={{ padding: '7px 11px', color: 'rgba(255,255,255,0.65)', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          }
          const modeInfo = msg.mode ? MODES[msg.mode] : null;
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '16px', paddingRight: '4px' }}>
              <div style={{ flexShrink: 0, marginTop: '2px' }}><GlanceLogo size={14} /></div>
              <div style={{ fontSize: '13px', flex: 1 }}>
                {modeInfo && (
                  <span style={{
                    display: 'inline-block', marginBottom: '7px',
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', padding: '2px 7px', borderRadius: '4px',
                    background: modeInfo.color + '22', color: modeInfo.color,
                    border: `1px solid ${modeInfo.color}44`,
                  }}>
                    {modeInfo.label}
                  </span>
                )}
                <StreamingText text={msg.text} />
              </div>
            </div>
          );
        })}

        {/* Streaming response */}
        {streaming && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', paddingRight: '4px' }}>
            <div style={{ flexShrink: 0, marginTop: '2px' }}><GlanceLogo size={14} /></div>
            <div style={{ fontSize: '13px', flex: 1 }}>
              <StreamingText text={parseMode(streaming).body} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', marginBottom: '10px' }}>
            <p style={{ color: 'rgb(252,165,165)', fontSize: '12px', margin: 0 }}>{error}</p>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <form onSubmit={handleFollowup} style={{ display: 'flex', gap: '8px' }}>
          {hasMessages && (
            <button
              type="button"
              onClick={handleNewChat}
              title="New chat"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.55)',
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
                WebkitAppRegion: 'no-drag',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            >
              <NewChatIcon />
            </button>
          )}
          <input
            value={question}
            onChange={(e) => { setQuestion(e.target.value); questionRef.current = e.target.value; }}
            placeholder={isTranscribing ? 'Transcribing…' : isListening ? 'Recording… click mic to stop' : hasMessages ? 'Ask a follow-up…' : 'Ask something, then capture…'}
            disabled={loading}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'rgba(255,255,255,0.85)',
              fontSize: '12.5px',
              outline: 'none',
              WebkitAppRegion: 'no-drag',
            }}
            onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.4)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
          <button
            type="button"
            onClick={toggleVoice}
            disabled={isTranscribing}
            className={isListening ? 'mic-listening' : ''}
            title={isListening ? 'Stop recording' : isTranscribing ? 'Transcribing…' : 'Voice input'}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '8px 10px',
              color: isTranscribing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
              cursor: isTranscribing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
              WebkitAppRegion: 'no-drag',
            }}
          >
            <MicIcon active={isListening} />
          </button>
          <button
            type="submit"
            disabled={!hasMessages || !question.trim() || loading}
            title="Send"
            style={{
              background: 'rgba(139,92,246,0.2)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '8px',
              padding: '8px 10px',
              color: 'rgba(255,255,255,0.85)',
              cursor: (!hasMessages || !question.trim() || loading) ? 'not-allowed' : 'pointer',
              opacity: (!hasMessages || !question.trim() || loading) ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
              WebkitAppRegion: 'no-drag',
            }}
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
