import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      <TriangleAlert className="size-8 text-fpl-pink" />
      <div>
        <h2 className="text-lg font-semibold">Couldn’t load that team</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button onClick={onRetry}>Try a different ID</Button>
    </div>
  );
}
