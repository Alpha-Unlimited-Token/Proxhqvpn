import { NodeHealthCard } from "./NodeHealthCard";

export function NodeGrid({ nodes }: { nodes: any[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {nodes.map((node) => (
        <NodeHealthCard key={node.id ?? node.nodeId} node={node} />
      ))}
    </div>
  );
}
