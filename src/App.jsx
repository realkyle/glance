import { useState, useEffect, useRef, useCallback } from 'react';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are Glance — a real-time AI assistant embedded in the user's screen overlay. When shown a screenshot, give concise, actionable, specific suggestions. Use 2-4 short bullet points (•). Be direct. No fluff. Focus on what's most immediately useful.`;

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

function GlanceLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="4" fill="rgb(139,92,246)" />
      <circle cx="12" cy="12" r="9" stroke="rgb(139,92,246)" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5" />
      <circle cx="12" cy="12" r="11" stroke="rgb(139,92,246)" strokeWidth="0.75" opacity="0.2" />
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

function StreamingText({ text }) {
  const parts = text.split(/(\•[^\•\n]+)/g);
  return (
    <div className="space-y-1.5">
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
            <p key={i} className="fade-in" style={{ color: 'rgba(255,255,255,0.75)', lineHeight: '1.55' }}>
              {parseInline(part)}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function App() {
  const [screenshot, setScreenshot] = useState(null);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [hasCapture, setHasCapture] = useState(false);
  const responseRef = useRef('');
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  const sendToClaudeStreaming = useCallback(async (imageDataUrl, userQ) => {
    if (!API_KEY) {
      setError('No API key. Add VITE_ANTHROPIC_API_KEY to .env');
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError('');
    setResponse('');
    responseRef.current = '';

    const base64 = imageDataUrl.split(',')[1];

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
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
              { type: 'text', text: userQ?.trim() || 'What do you see? Give me real-time suggestions.' },
            ],
          }],
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
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              responseRef.current += parsed.delta.text;
              setResponse(responseRef.current);
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCapture = useCallback(async () => {
    try {
      const dataUrl = await window.electronAPI.requestScreenshot();
      setScreenshot(dataUrl);
      setHasCapture(true);
      await sendToClaudeStreaming(dataUrl, question);
    } catch (err) {
      setError(err.message || 'Screenshot failed');
    }
  }, [question, sendToClaudeStreaming]);

  const handleAskFollowup = useCallback(async (e) => {
    e.preventDefault();
    if (!screenshot || !question.trim() || loading) return;
    await sendToClaudeStreaming(screenshot, question);
    setQuestion('');
  }, [screenshot, question, loading, sendToClaudeStreaming]);

  useEffect(() => {
    window.electronAPI?.onScreenshot((dataUrl) => {
      setScreenshot(dataUrl);
      setHasCapture(true);
      sendToClaudeStreaming(dataUrl, '');
    });
    window.electronAPI?.onScreenshotError((msg) => setError(msg));
  }, [sendToClaudeStreaming]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response]);

  const isEmpty = !loading && !response && !error;

  return (
    <div
      style={{
        width: '400px',
        height: '560px',
        background: 'rgba(10, 10, 15, 0.92)',
        backdropFilter: 'blur(24px)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header — drag region */}
      <div
        style={{
          WebkitAppRegion: 'drag',
          padding: '14px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
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
          <kbd style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: '10px',
            background: 'rgba(255,255,255,0.06)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: 'monospace',
          }}>
            ⌃⇧Space
          </kbd>
          <button
            onClick={() => window.electronAPI?.minimizeWindow()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.3)',
              padding: '2px 4px',
              borderRadius: '4px',
              fontSize: '14px',
              lineHeight: 1,
              WebkitAppRegion: 'no-drag',
            }}
            title="Minimize"
          >
            −
          </button>
          <button
            onClick={() => window.electronAPI?.closeWindow()}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.25)',
              padding: '2px 4px',
              borderRadius: '4px',
              fontSize: '14px',
              lineHeight: 1,
              WebkitAppRegion: 'no-drag',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Capture button */}
      <div style={{ padding: '12px 16px 10px', flexShrink: 0 }}>
        <button
          className="btn-capture"
          onClick={handleCapture}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '10px',
            border: '1px solid rgba(139,92,246,0.4)',
            background: loading
              ? 'rgba(139,92,246,0.08)'
              : 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(109,40,217,0.22))',
            color: loading ? 'rgba(139,92,246,0.5)' : 'rgb(196,167,255)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            letterSpacing: '0.01em',
            transition: 'all 0.15s ease',
            WebkitAppRegion: 'no-drag',
          }}
        >
          <CaptureIcon />
          {loading ? 'Analyzing…' : hasCapture ? 'Re-capture Screen' : 'Capture Screen'}
        </button>
      </div>

      {/* Screenshot thumbnail */}
      {screenshot && (
        <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
          <div style={{
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            position: 'relative',
            height: '72px',
          }}>
            <img
              src={screenshot}
              alt="screenshot"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.7 }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to right, rgba(10,10,15,0.3), transparent)',
            }} />
            <span style={{
              position: 'absolute', bottom: '6px', left: '8px',
              color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 500,
            }}>
              captured
            </span>
          </div>
        </div>
      )}

      {/* Response area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px',
          minHeight: 0,
        }}
      >
        {isEmpty && (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}>
            <div style={{
              width: '48px', height: '48px',
              borderRadius: '50%',
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GlanceLogo />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
              Press <strong style={{ color: 'rgba(255,255,255,0.4)' }}>Ctrl+Shift+Space</strong><br />
              or click Capture to get AI suggestions
            </p>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px',
            marginBottom: '10px',
          }}>
            <p style={{ color: 'rgb(252,165,165)', fontSize: '12px' }}>{error}</p>
          </div>
        )}

        {response && (
          <div style={{ paddingBottom: '12px' }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(139,92,246,0.7)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '10px',
            }}>
              Glance suggests
            </div>
            <div style={{ fontSize: '13px' }}>
              <StreamingText text={response} />
            </div>
          </div>
        )}
      </div>

      {/* Follow-up input */}
      <div style={{
        padding: '10px 16px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <form onSubmit={handleAskFollowup} style={{ display: 'flex', gap: '8px' }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={hasCapture ? 'Ask a follow-up…' : 'Ask about the screen…'}
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
            onFocus={(e) => { e.target.style.borderColor = 'rgba(139,92,246,0.4)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
          <button
            type="submit"
            disabled={!hasCapture || !question.trim() || loading}
            style={{
              background: 'rgba(139,92,246,0.2)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'rgb(196,167,255)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: (!hasCapture || !question.trim() || loading) ? 'not-allowed' : 'pointer',
              opacity: (!hasCapture || !question.trim() || loading) ? 0.4 : 1,
              transition: 'opacity 0.15s',
              WebkitAppRegion: 'no-drag',
            }}
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
