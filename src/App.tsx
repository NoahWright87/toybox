import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import StarfieldPage from "./pages/StarfieldPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/starfield" element={<StarfieldPage />} />
      </Routes>
    </BrowserRouter>
  );
}
