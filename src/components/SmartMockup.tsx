import React, { useState, useEffect } from "react";
import { Smartphone, Laptop } from "lucide-react";

interface SmartMockupProps {
  children: React.ReactNode;
  title: string;
}

export function SmartMockup({ children, title }: SmartMockupProps) {
  const [isFullscreenOnDesktop, setIsFullscreenOnDesktop] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-950">

      {/* Barra de control de modo — solo visible en escritorio */}
      <div className="hidden lg:flex items-center justify-between w-full px-6 py-2 bg-slate-900 border-b border-slate-800 shrink-0 z-50">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase">
            Modo visualización · Reporte de Campo
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsFullscreenOnDesktop(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              !isFullscreenOnDesktop
                ? "bg-sky-500 border-sky-500 text-white shadow-sm shadow-sky-500/20"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Modo 9:16 (Campo)
          </button>
          <button
            onClick={() => setIsFullscreenOnDesktop(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              isFullscreenOnDesktop
                ? "bg-sky-500 border-sky-500 text-white shadow-sm shadow-sky-500/20"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Pantalla Completa
          </button>
        </div>
      </div>

      {isFullscreenOnDesktop ? (
        /* Escritorio ancho: ocupa todo el ancho */
        <div className="w-full flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {children}
        </div>
      ) : (
        /* 9:16 — centrado en escritorio, borde-a-borde en móvil */
        <div className="flex-1 flex flex-col items-center justify-start bg-slate-950 w-full">
          <div className="w-full lg:max-w-sm xl:max-w-[420px] flex flex-col flex-1 bg-slate-950">

            {/* Status bar simulada — solo visible en desktop */}
            <div className="hidden lg:flex bg-slate-950 text-white text-[11px] px-5 pt-3 pb-1.5 justify-between items-center shrink-0 select-none">
              <span className="font-semibold tracking-tight font-mono">{currentTime || "12:00"}</span>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5 items-end h-2.5">
                  <div className="w-0.5 h-1 bg-white rounded-full" />
                  <div className="w-0.5 h-1.5 bg-white rounded-full" />
                  <div className="w-0.5 h-2 bg-white rounded-full" />
                  <div className="w-0.5 h-2.5 bg-white rounded-full" />
                </div>
                <span className="font-mono text-[9px]">5G</span>
                <div className="border border-white/80 w-5 h-2.5 rounded-sm p-0.5 flex items-center">
                  <div className="bg-white h-full w-[85%] rounded-[1px]" />
                </div>
              </div>
            </div>

            {/* Contenido principal — scrollable, ocupa todo el alto */}
            <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col bg-slate-950">
              {children}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
