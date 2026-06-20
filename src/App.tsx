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
import WordsPage from "./pages/WordsPage";
import ChainReactionPage from "./pages/ChainReactionPage";
import PegSolitairePage from "./pages/PegSolitairePage";
import GooberDressupPage from "./pages/GooberDressupPage";
import HellMapEditorPage from "./pages/HellMapEditorPage";
import CheckersPage from "./pages/CheckersPage";
import MahjongSolitairePage from "./pages/MahjongSolitairePage";
import JazzballPage from "./pages/JazzballPage";
import BrickBreakerPage from "./pages/BrickBreakerPage";
import JigsawPuzzlePage from "./pages/JigsawPuzzlePage";

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
        <Route path="/words" element={<WordsPage />} />
        <Route path="/component-test" element={<ComponentTestPage />} />
        <Route path="/chain-reaction" element={<ChainReactionPage />} />
        <Route path="/peg-solitaire" element={<PegSolitairePage />} />
        <Route path="/goober-dressup" element={<GooberDressupPage />} />
        <Route path="/hell-map-editor" element={<HellMapEditorPage />} />
        <Route path="/checkers" element={<CheckersPage />} />
        <Route path="/mahjong-solitaire" element={<MahjongSolitairePage />} />
        <Route path="/jazzball" element={<JazzballPage />} />
        <Route path="/brick-breaker" element={<BrickBreakerPage />} />
        <Route path="/jigsaw-puzzle" element={<JigsawPuzzlePage />} />
      </Routes>
    </BrowserRouter>
  );
}
