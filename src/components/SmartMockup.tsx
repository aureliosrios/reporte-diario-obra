import React, { useState, useEffect } from "react";
import { Phone, Laptop, Smartphone, Eye, EyeOff, Sparkles, AlertCircle } from "lucide-react";

interface SmartMockupProps {
  children: React.ReactNode;
  title: string;
}

export function SmartMockup({ children, title }: SmartMockupProps) {
  const [isFullscreenOnDesktop, setIsFullscreenOnDesktop] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // Generate simulated telephone system clock
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
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-slate-100 p-2 sm:p-4 text-slate-800 transition-all duration-300">
      
      {/* Control panel to switch between Simulated Mobile Frame on Desktop vs Clean Layout */}
      <div className="hidden lg:flex items-center justify-between w-full max-w-5xl mb-3 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-600 font-sans">
            MODO DE VISUALIZACIÓN EN ESCRITORIO
          </span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setIsFullscreenOnDesktop(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              !isFullscreenOnDesktop
                ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Simulador Móvil (Campo)
          </button>
          
          <button
            onClick={() => setIsFullscreenOnDesktop(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isFullscreenOnDesktop
                ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Pantalla Completa
          </button>
        </div>
      </div>

      {isFullscreenOnDesktop ? (
        // Clean high-impact wide layout
        <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[85vh] transition-all duration-300">
          {children}
        </div>
      ) : (
        // Smartphone Bezel frame on desktop, transparent on true mobile
        <div className="w-full max-w-sm sm:max-w-md lg:max-w-[430px] transition-all duration-300">
          {/* Smartphone device container */}
          <div className="relative mx-auto lg:border-[12px] lg:border-slate-900 lg:rounded-[55px] lg:shadow-2xl overflow-hidden bg-slate-950 aspect-[9/19.5] lg:h-[900px] w-full flex flex-col justify-between">
            {/* Dynamic camera punch-hole notch on desktop */}
            <div className="hidden lg:block absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-50">
              <div className="absolute top-1.5 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-900/50" />
              </div>
            </div>

            {/* Simulated Mobile Device Top Status Bar */}
            <div className="bg-slate-900 text-white text-[11px] px-6 pt-3 pb-2 flex justify-between items-center z-40 select-none border-b border-slate-800">
              <span className="font-semibold tracking-tight">{currentTime || "12:00"}</span>
              <div className="flex items-center gap-1.5">
                {/* Simulated Signal Bars */}
                <div className="flex gap-0.5 items-end h-2.5">
                  <div className="w-0.5 h-1 bg-white rounded-full" />
                  <div className="w-0.5 h-1.5 bg-white rounded-full" />
                  <div className="w-0.5 h-2 bg-white rounded-full" />
                  <div className="w-0.5 h-2.5 bg-white rounded-full" />
                </div>
                <span className="font-mono text-[9px]">5G</span>
                {/* Simulated Battery Icon */}
                <div className="border border-white/80 w-5 h-2.5 rounded-sm p-0.5 flex items-center">
                  <div className="bg-white h-full w-[85%] rounded-[1px]" />
                </div>
              </div>
            </div>

            {/* Core Application Frame Body */}
            <div className="flex-1 bg-slate-50 overflow-y-auto relative scrollbar-none flex flex-col justify-start">
              {children}
            </div>

            {/* Physical home pill indicator at very bottom */}
            <div className="hidden lg:block bg-slate-950 py-3 text-center">
              <span className="inline-block w-28 h-1 bg-white/30 rounded-full hover:bg-white/60 transition" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
