import { useState } from "react";

interface Props {
  onCreateSession: () => void;
  onJoinSession: (code: string) => void;
}

export function HomePage({ onCreateSession, onJoinSession }: Props) {
  const [joinCode, setJoinCode] = useState("");

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="bg-bg-surface border border-border-default rounded-xl px-12 py-14 w-[460px] text-center">
        <h1 className="font-display text-[32px] font-bold text-gold-bright tracking-tight mb-1.5">
          ⚔ DnD Battlefield
        </h1>
        <p className="text-text-muted text-sm italic mb-10">Forge your encounter</p>

        <button
          onClick={onCreateSession}
          className="w-full py-3.5 px-6 bg-gradient-to-br from-gold-bright to-gold-muted text-bg-deep font-semibold text-[15px] rounded-lg cursor-pointer shadow-[0_2px_12px_rgba(202,169,104,0.2)] transition-all duration-150 hover:shadow-[0_4px_20px_rgba(202,169,104,0.35)] hover:-translate-y-0.5"
        >
          Create New Session
        </button>

        <div className="h-px bg-border-default my-7" />

        <p className="text-text-muted text-sm mb-4">Or join an existing session</p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="CODE"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="flex-1 py-3.5 px-4 bg-bg-deep border border-border-default rounded-lg text-text-primary text-[15px] text-center tracking-[0.3em] font-semibold outline-none transition-all duration-150 focus:border-gold-muted focus:shadow-[0_0_0_3px_rgba(202,169,104,0.15)] placeholder:text-text-muted placeholder:tracking-widest placeholder:font-normal"
          />
          <button
            onClick={() => joinCode && onJoinSession(joinCode)}
            disabled={!joinCode}
            className="py-3.5 px-6 bg-transparent text-gold-bright font-medium text-[15px] border border-border-hover rounded-lg cursor-pointer transition-all duration-150 hover:bg-gold-subtle hover:border-gold-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
