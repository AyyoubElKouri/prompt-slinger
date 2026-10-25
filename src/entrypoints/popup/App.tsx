export default function App() {
  return (
    <div className="w-[360px] min-h-[380px] bg-white text-zinc-900 flex flex-col rounded-2xl overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <span className="text-sm font-semibold tracking-tight">Prompt Slinger</span>
        <span className="text-xs text-zinc-500">v0.0.0</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-8 py-10">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-xl mb-5">
          👋
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Hello from me</h1>
        <p className="mt-2 text-sm leading-5 text-zinc-500 max-w-[240px]">
          Thanks for installing Prompt Slinger. Everything is set up and ready to go.
        </p>
        <button className="mt-6 w-full h-9 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors">
          Got it
        </button>
      </main>

      <footer className="px-5 py-3 border-t border-zinc-100 text-center text-xs text-zinc-400">
        Have a great day
      </footer>
    </div>
  );
}
