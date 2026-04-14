import NsDoors97 from "../experiences/NsDoors97/NsDoors97";
import { OsDialogProvider } from "../experiences/NsDoors97/OsDialog";

export default function NsDoors97Page() {
  return (
    <OsDialogProvider>
      <NsDoors97 />
    </OsDialogProvider>
  );
}
