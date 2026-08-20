import { Suspense } from "react";
import { RoomBrowser } from "@/components/RoomBrowser";

export default function CirclesPage() {
  return (
    <Suspense>
      <RoomBrowser />
    </Suspense>
  );
}
