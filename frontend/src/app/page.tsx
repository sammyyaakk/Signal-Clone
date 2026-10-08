"use client";

import { useEffect, useState } from "react";
import { Messenger } from "@/components/Messenger";
import { Onboarding } from "@/components/Onboarding";
import { Toasts } from "@/components/ui/Toasts";
import { useChat } from "@/store/chat";

export default function Home() {
  const me = useChat((s) => s.me);
  const restoreSession = useChat((s) => s.restoreSession);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    restoreSession().finally(() => setRestoring(false));
  }, [restoreSession]);

  if (restoring) return null;
  return (
    <>
      {me?.display_name ? <Messenger /> : <Onboarding />}
      <Toasts />
    </>
  );
}
