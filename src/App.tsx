import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import StarfieldPage from "./pages/StarfieldPage";
import FireworksPage from "./pages/FireworksPage";
import BouncingShapesPage from "./pages/BouncingShapesPage";
import ScrollingTextPage from "./pages/ScrollingTextPage";
import BouncingPolygonsPage from "./pages/BouncingPolygonsPage";
import RainingEmojisPage from "./pages/RainingEmojisPage";
import TypingRacerPage from "./pages/TypingRacerPage";
import NumberMuncherPage from "./pages/NumberMuncherPage";
import TicTacToePage from "./pages/TicTacToePage";
import WordWhirlwindPage from "./pages/WordWhirlwindPage";
import BombFinderPage from "./pages/BombFinderPage";
import NsDoors97Page from "./pages/NsDoors97Page";
import NsToSPage from "./pages/NsToSPage";
import DuckHuntPage from "./pages/DuckHuntPage";
import NsArtPage from "./pages/NsArtPage";
import HellPage from "./pages/HellzonePage";
import ComponentTestPage from "./pages/ComponentTestPage";
import PoolPage from "./pages/PoolPage";
import MidiEditorPage from "./pages/MidiEditorPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NsDoors97Page />} />
        <Route path="/toybox" element={<HomePage />} />
        <Route path="/starfield" element={<StarfieldPage />} />
        <Route path="/fireworks" element={<FireworksPage />} />
        <Route path="/bouncing-shapes" element={<BouncingShapesPage />} />
        <Route path="/scrolling-text" element={<ScrollingTextPage />} />
        <Route path="/bouncing-polygons" element={<BouncingPolygonsPage />} />
        <Route path="/raining-emojis" element={<RainingEmojisPage />} />
        <Route path="/typing-racer" element={<TypingRacerPage />} />
        <Route path="/number-muncher" element={<NumberMuncherPage />} />
        <Route path="/tic-tac-toe" element={<TicTacToePage />} />
        <Route path="/word-whirlwind" element={<WordWhirlwindPage />} />
        <Route path="/bomb-finder" element={<BombFinderPage />} />
        <Route path="/doors97" element={<NsDoors97Page />} />
        <Route path="/ns-tos" element={<NsToSPage />} />
        <Route path="/duck-hunt" element={<DuckHuntPage />} />
        <Route path="/art" element={<NsArtPage />} />
        <Route path="/hell" element={<HellPage />} />
        <Route path="/pool" element={<PoolPage />} />
        <Route path="/midi-editor" element={<MidiEditorPage />} />
        <Route path="/component-test" element={<ComponentTestPage />} />
      </Routes>
    </BrowserRouter>
  );
}
