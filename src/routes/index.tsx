import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gate } from "@/components/game/gate";
import { GameShell } from "@/components/game/shell";
import { unlockAudio } from "@/game/audio";
import { boot } from "@/game/world";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [on, setOn] = useState(false);
  if (!on) {
    return (
      <Gate
        onEnter={() => {
          boot();
          unlockAudio();
          setOn(true);
        }}
      />
    );
  }
  return <GameShell />;
}
