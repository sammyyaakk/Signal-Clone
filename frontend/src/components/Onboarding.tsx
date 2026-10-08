"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { AVATAR_COLORS } from "@/lib/format";
import { useChat } from "@/store/chat";
import { Avatar } from "./ui/Avatar";

type Step = "phone" | "code" | "profile";

/** Mocked Signal registration: phone number -> fixed OTP -> profile name and avatar. */
export function Onboarding() {
  const { me, login, updateProfile } = useChat();
  const [step, setStep] = useState<Step>(me ? "profile" : "phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = (action: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = run(async () => {
    if (!/^\+?\d{7,15}$/.test(phone)) throw new ApiError(400, "Enter a valid phone number");
    setStep("code");
  });

  const submitCode = run(async () => {
    const auth = await api.verify(phone, code);
    login(auth);
    if (auth.needs_profile) setStep("profile");
  });

  const submitProfile = run(() => updateProfile({ display_name: name.trim(), avatar_color: color }));

  return (
    <main className="onboarding">
      <div className="onboarding-card">
        <div className="signal-logo">
          <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden>
            <circle cx="24" cy="24" r="22" fill="var(--ultramarine)" />
            <path d="M14 33l2-6a10 10 0 1 1 5 4z" fill="#fff" />
          </svg>
        </div>

        {step === "phone" && (
          <form onSubmit={submitPhone}>
            <h1>Phone number</h1>
            <p className="muted">Enter your phone number to get started. Try a seeded user like +15550000001.</p>
            <input autoFocus className="text-input" placeholder="+1 555 000 0001" value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[\s-]/g, ""))} />
            <button className="primary-button" disabled={busy || !phone}>Next</button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={submitCode}>
            <h1>Verification code</h1>
            <p className="muted">Enter the code we sent to {phone}. (Demo code: 123456)</p>
            <input autoFocus className="text-input" inputMode="numeric" maxLength={6} placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="primary-button" disabled={busy || code.length !== 6}>Continue</button>
            <button type="button" className="link-button" onClick={() => setStep("phone")}>Wrong number?</button>
          </form>
        )}

        {step === "profile" && (
          <form onSubmit={submitProfile}>
            <h1>Set up your profile</h1>
            <p className="muted">Your profile is visible to people you message.</p>
            <div className="profile-preview">
              <Avatar name={name || "?"} color={color} size={80} />
            </div>
            <div className="color-picker">
              {AVATAR_COLORS.map((c) => (
                <button type="button" key={c} aria-label={c} className={c === color ? "selected" : ""}
                  style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
            <input autoFocus className="text-input" placeholder="Your name" maxLength={60} value={name}
              onChange={(e) => setName(e.target.value)} />
            <button className="primary-button" disabled={busy || !name.trim()}>Save</button>
          </form>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>
    </main>
  );
}

