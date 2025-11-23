function ModeToggle({ isDarkMode, setIsDarkMode }) {
  return (
    <button
      onClick={() => setIsDarkMode(!isDarkMode)}
      className={`relative w-18 h-9 rounded-full cursor-pointer transition-all duration-300 flex items-center p-1 ${
        isDarkMode
          ? "bg-black border-2 border-white"
          : "bg-gradient-to-r from-pink-300 to-yellow-300 border-0 shadow-md"
      } hover:scale-105`}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Toggle knob */}
      <div
        className={`absolute top-1 left-1 w-6 h-6 rounded-full transition-all duration-300 flex items-center justify-center text-sm ${
          isDarkMode
            ? "bg-white translate-x-0"
            : "bg-white translate-x-8 shadow-md"
        }`}
      >
        {/* Cute icon when light mode */}
        <span className="pointer-events-none">
          {isDarkMode ? "🌑" : "🌞"}
        </span>
      </div>

      {/* Label or small text */}
      <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold pointer-events-none ${isDarkMode ? 'text-white' : 'text-white'}`}>
        {isDarkMode ? "" : ""}
      </span>
    </button>
  );
}

export default ModeToggle;
