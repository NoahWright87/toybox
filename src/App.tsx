import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import StarfieldPage from "./pages/StarfieldPage";
import FireworksPage from "./pages/FireworksPage";
import BouncingShapesPage from "./pages/BouncingShapesPage";
import TypingRacerPage from "./pages/TypingRacerPage";
import NumberMuncherPage from "./pages/NumberMuncherPage";
import TicTacToePage from "./pages/TicTacToePage";
import WordWhirlwindPage from "./pages/WordWhirlwindPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/starfield" element={<StarfieldPage />} />
        <Route path="/fireworks" element={<FireworksPage />} />
        <Route path="/bouncing-shapes" element={<BouncingShapesPage />} />
        <Route path="/typing-racer" element={<TypingRacerPage />} />
        <Route path="/number-muncher" element={<NumberMuncherPage />} />
        <Route path="/tic-tac-toe" element={<TicTacToePage />} />
        <Route path="/word-whirlwind" element={<WordWhirlwindPage />} />
      </Routes>
    </BrowserRouter>
  );
}
