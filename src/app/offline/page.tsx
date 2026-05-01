"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-6">
      <div className="max-w-sm w-full text-center">
        {/* Icon */}
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          You&apos;re offline
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          BreastScreen AI needs an internet connection to load your latest
          screening data and communicate with your care team.
        </p>

        {/* Retry button */}
        <button
          onClick={() => window.location.reload()}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          Try Again
        </button>

        <p className="mt-6 text-xs text-slate-400">
          BreastScreen<span className="text-blue-500">AI</span> · Patient App
        </p>
      </div>
    </div>
  );
}
