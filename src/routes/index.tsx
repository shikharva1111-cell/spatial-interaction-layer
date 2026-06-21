import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

function Page() {
  const [Comp, setComp] = useState<ComponentType | null>(null);
  useEffect(() => {
    import("@/components/PreviewApp").then((m) => setComp(() => m.default));
  }, []);
  if (!Comp) return <div style={{ height: "100vh", background: "#EAECF0" }} />;
  return <Comp />;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sarathi AI — Preview" },
      { name: "description", content: "Preview of the Sarathi AI road safety app design." },
    ],
  }),
  component: Page,
});
