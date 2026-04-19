import BouncingShapes from "../experiences/BouncingShapes/BouncingShapes";
import ScreensaverPage from "../components/ScreensaverPage/ScreensaverPage";

export default function BouncingShapesPage() {
  return (
    <ScreensaverPage background="#111">
      <BouncingShapes />
    </ScreensaverPage>
  );
}
