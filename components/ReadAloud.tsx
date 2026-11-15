'use client';
import { Icon } from './ui';

export function ReadAloud({ text, label = 'Read this to me' }: { text: string; label?: string }) {
  return (
    <button type="button" className="btn out" style={{ alignSelf: 'flex-start' }}
      onClick={() => {
        try {
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 0.85;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        } catch { /* speech not available on this device */ }
      }}>
      <Icon name="speaker" size={24} />{label}
    </button>
  );
}
