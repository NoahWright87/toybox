import NsDoors97 from "../experiences/NsDoors97/NsDoors97";
import { OsDialogProvider } from "../experiences/NsDoors97/OsDialog";
import { FSProvider } from "../experiences/NsDoors97/filesystem";

export default function NsDoors97Page() {
  return (
    <FSProvider>
      <OsDialogProvider>
        <NsDoors97 />
      </OsDialogProvider>
    </FSProvider>
  );
}
