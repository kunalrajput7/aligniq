'use client';

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  memo,
  useRef,
} from 'react';
import ReactFlow, {
  Background,
  Handle,
  Position,
  MarkerType,
  Node,
  Edge,
  NodeProps,
  DefaultEdgeOptions,
} from 'reactflow';
import type { ReactFlowInstance } from 'reactflow';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs';
import 'reactflow/dist/style.css';
import { Mindmap, MindmapNode } from '@/types/api';
import './mindmap.css';

type NodeData = {
  label: string;
  type: string;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle: (id: string) => void;
  width: number;
  height: number;
};

const palette: Record<string, string> = {
  root: '#4f46e5',
  theme: '#2563eb',
  chapter: '#7c3aed',
  claim: '#0ea5e9',
  topic: '#6366f1',
  decision: '#2563eb',
  action: '#0ea5e9',
  achievement: '#14b8a6',
  blocker: '#ef4444',
  concern: '#ea580c',
};

const NODE_SIZE: Record<string, { width: number; height: number }> = {
  root: { width: 400, height: 120 },
  theme: { width: 350, height: 100 },
  chapter: { width: 350, height: 100 },
  claim: { width: 350, height: 100 },
  action: { width: 350, height: 100 },
  achievement: { width: 350, height: 100 },
  blocker: { width: 350, height: 100 },
  decision: { width: 350, height: 100 },
  concern: { width: 350, height: 100 },
};

const elk = new ELK();

const layoutOptions = {
  algorithm: 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '200',
  'elk.spacing.nodeNode': '80',
  'elk.spacing.edgeNode': '70',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
};

interface MindmapCanvasProps {
  mindmap: Mindmap;
}

/** ELK augments nodes with positions; we extend the type to include x/y. */
type LaidOutElkNode = ElkNode & { x?: number; y?: number; children?: LaidOutElkNode[] };

const MindmapNodeCard = memo<NodeProps<NodeData>>(({ data, id }) => {
  const { label, type, hasChildren, collapsed, onToggle, width, height } = data;
  const color = palette[type] ?? palette.theme;
  const gradient = `linear-gradient(135deg, ${color}F2, ${color}D0)`;
  const borderColor = `${color}80`;

  return (
    <div
      className="mindmap-node"
      data-type={type}
      style={{ background: gradient, borderColor, width, minHeight: height, height: 'auto' }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          left: -16,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
        isConnectable={false}
      />
      <div className="mindmap-node-label">{label}</div>
      {hasChildren && (
        <button
          className="mindmap-node-toggle"
          style={{ color }}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(id);
          }}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '>' : '<'}
        </button>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          right: hasChildren ? -60 : -18,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
        isConnectable={false}
      />
    </div>
  );
});
MindmapNodeCard.displayName = 'MindmapNodeCard';

const nodeTypes = { mindmapNode: MindmapNodeCard };

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: '#aeb5ff',
  },
  style: {
    stroke: '#aeb5ff',
    strokeWidth: 2,
  },
};

/** Returns a known size for each node type. */
const getNodeSize = (type: string) => NODE_SIZE[type] ?? NODE_SIZE.claim;

const buildGraph = (
  mindmap: Mindmap,
  collapsed: Set<string>,
  onToggle: (id: string) => void
): { nodes: Node<NodeData>[]; edges: Edge[] } => {
  const rootId = mindmap.center_node.id;
  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, MindmapNode[]>();

  for (const node of mindmap.nodes) {
    parentMap.set(node.id, node.parent_id);
    const existing = childrenMap.get(node.parent_id) ?? [];
    childrenMap.set(node.parent_id, [...existing, node]);
  }

  const isVisible = (id: string) => {
    let current = parentMap.get(id);
    while (current) {
      if (collapsed.has(current)) return false;
      current = parentMap.get(current);
    }
    return true;
  };

  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  // Root
  const rootChildren = childrenMap.get(rootId) ?? [];
  const rootSize = getNodeSize('root');
  nodes.push({
    id: rootId,
    type: 'mindmapNode',
    position: { x: 0, y: 0 },
    data: {
      label: mindmap.center_node.label,
      type: 'root',
      hasChildren: rootChildren.length > 0,
      collapsed: collapsed.has(rootId),
      onToggle,
      width: rootSize.width,
      height: rootSize.height,
    },
    draggable: false,
    selectable: false,
  });

  // Others
  for (const node of mindmap.nodes) {
    if (!isVisible(node.id)) continue;
    const parentId = parentMap.get(node.id);
    if (!parentId || !isVisible(parentId)) continue;

    const nodeSize = getNodeSize(node.type);
    const hasChildren = (childrenMap.get(node.id) ?? []).length > 0;

    nodes.push({
      id: node.id,
      type: 'mindmapNode',
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        type: node.type,
        hasChildren,
        collapsed: collapsed.has(node.id),
        onToggle,
        width: nodeSize.width,
        height: nodeSize.height,
      },
      draggable: false,
      selectable: false,
    });

    edges.push({
      id: `${parentId}->${node.id}`,
      source: parentId,
      target: node.id,
      // per-edge styling (compatible with DefaultEdgeOptions)
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: '#aeb5ff',
      },
      style: {
        stroke: '#aeb5ff',
        strokeWidth: 2,
      },
    });
  }

  return { nodes, edges };
};

const layoutGraph = async (
  nodes: Node<NodeData>[],
  edges: Edge[]
): Promise<{ nodes: Node<NodeData>[]; edges: Edge[] }> => {
  // Nothing to lay out
  if (nodes.length === 0) return { nodes, edges };

  const graph = {
    id: 'root',
    layoutOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: (node.data?.width ?? 300) + (node.data?.hasChildren ? 80 : 0),
      height: node.data?.height ?? 80,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layouted = (await elk.layout(graph)) as LaidOutElkNode;
  const laidOutChildren: LaidOutElkNode[] = layouted.children ?? [];

  const positions: Record<string, { x: number; y: number }> = Object.fromEntries(
    laidOutChildren.map((child) => [
      child.id as string,
      { x: child.x ?? 0, y: child.y ?? 0 },
    ])
  );

  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position ?? { x: 0, y: 0 },
  }));

  return { nodes: positionedNodes, edges };
};

export function MindmapCanvas({ mindmap }: MindmapCanvasProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);

  const toggleNode = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const graph = useMemo(
    () => buildGraph(mindmap, collapsed, toggleNode),
    [mindmap, collapsed, toggleNode]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { nodes: laidNodes, edges: laidEdges } = await layoutGraph(graph.nodes, graph.edges);
      if (cancelled) return;

      setNodes(laidNodes);
      setEdges(laidEdges);

      if (reactFlowRef.current) {
        requestAnimationFrame(() => {
          reactFlowRef.current?.fitView({ padding: 0.25, duration: 420 });
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [graph]);

  // Render nothing until we have at least the root node
  if (nodes.length === 0) {
    return <div className="mindmap-board" />;
  }

  return (
    <div className="mindmap-board">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        onInit={(instance) => {
          reactFlowRef.current = instance;
          instance.fitView({ padding: 0.25, duration: 0 });
        }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        onWheel={(event: React.WheelEvent) => {
          if (event.ctrlKey) return;
          event.preventDefault();
          const instance = reactFlowRef.current;
          if (!instance) return;
          const currentZoom = instance.getZoom();
          const delta = event.deltaY > 0 ? -0.18 : 0.18;
          const nextZoom = Math.min(2.5, Math.max(0.35, currentZoom + delta));
          instance.zoomTo(nextZoom, { duration: 180 });
        }}
      >
        <Background gap={28} color="#8a95b8" />
      </ReactFlow>
    </div>
  );
}
