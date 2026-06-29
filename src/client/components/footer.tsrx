import { theme } from "~/client/stores/theme-store";

export component Footer() {
  <footer
    class={`mt-10 py-6 text-center transition-colors duration-300 border-t ${
      theme() === "dark" ? "bg-[#0f0f0f] text-gray-400 border-white/10" : "bg-white text-gray-800 border-gray-100/10"
    }`}>
    <p>{"© 2026 Rottra. All rights reserved."}</p>
  </footer>
}
