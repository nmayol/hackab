function HomeButton({ onHome, isDarkMode = true }) {
  const base = "relative inline-flex items-center gap-2 pl-2 pr-4 py-2 font-bold text-sm cursor-pointer transition-all duration-300 rounded-3xl";
  const theme = isDarkMode
    ? "bg-black text-white hover:bg-gray-900"
    : "bg-gradient-to-r from-rose-100 via-amber-100 to-indigo-100 text-black shadow-lg";

  return (
    <button
      onClick={onHome}
      className={`${base} ${theme} overflow-hidden`}
      aria-label="Go to home page"
    >
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-full transition-transform duration-200 ${
          isDarkMode ? 'bg-white text-black' : 'bg-white/95 text-amber-500 shadow-md transform hover:scale-110'
        }`}
      >
        {isDarkMode ? '🏠' : '🏡'}
      </span>

      <span className="hidden sm:inline tracking-tight">HOME</span>

      {!isDarkMode && (
        <>
          <span className="absolute -top-1 -left-2 text-xs opacity-80 animate-pulse">✨</span>
          <span className="absolute -top-1 -right-2 text-xs opacity-70 animate-bounce">✦</span>
        </>
      )}
    </button>
  );
}

export default HomeButton;
