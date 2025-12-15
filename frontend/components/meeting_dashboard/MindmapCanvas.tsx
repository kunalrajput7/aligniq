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
  Controls,
  useReactFlow,
} from 'reactflow';
import type { ReactFlowInstance } from 'reactflow';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs';
import 'reactflow/dist/style.css';
import { Mindmap, MindmapNode } from '@/types/api';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import './mindmap.css';

type NodeData = {
  label: string;
  type: string;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle: (id: string) => void;
  width: number;
  height: number;
  isNew?: boolean;
};

const palette: Record<string, string> = {
  root: '#4f46e5',
  theme: '#3b82f6',
  chapter: '#374151',
  claim: '#475569',
  topic: '#6366f1',
  decision: '#2563eb',
  action: '#0ea5e9',
  achievement: '#14b8a6',
  blocker: '#ef4444',
  concern: '#ea580c',
};
// Dynamic node sizing based on text content
const calculateNodeSize = (label: string, type: string): { width: number; height: number } => {
  const textLength = label.length;

  // Base sizes per type
  const baseWidth: Record<string, number> = {
    root: 220,
    chapter: 200,
    claim: 180,
    theme: 200,
    action: 180,
    achievement: 180,
    blocker: 180,
    decision: 180,
    concern: 180,
  };

  // Calculate width: base + extra for longer text
  const base = baseWidth[type] ?? 180;
  const charsPerLine = 25; // Approximate characters per line
  const estimatedLines = Math.ceil(textLength / charsPerLine);

  // Width: grows slightly with text, capped at max
  const minWidth = base;
  const maxWidth = type === 'root' ? 350 : 300;
  const width = Math.min(maxWidth, Math.max(minWidth, base + Math.min(textLength * 1.5, 80)));

  // Height: grows with number of lines
  const lineHeight = 22;
  const basePadding = 40;
  const minHeight = type === 'root' ? 60 : 50;
  const calculatedHeight = basePadding + (estimatedLines * lineHeight);
  const height = Math.max(minHeight, calculatedHeight);

  return { width: Math.round(width), height: Math.round(height) };
};

const elk = new ELK();

const layoutOptions = {
  algorithm: 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '180',
  'elk.spacing.nodeNode': '50',
  'elk.spacing.edgeNode': '40',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.edgeRouting': 'SPLINES',
  'elk.layered.compaction.postCompaction.strategy': 'NONE',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
};

interface MindmapCanvasProps {
  mindmap: Mindmap;
}

type LaidOutElkNode = ElkNode & { x?: number; y?: number; children?: LaidOutElkNode[] };

// Animated Node Component
const MindmapNodeCard = memo<NodeProps<NodeData>>(({ data, id }) => {
  const { label, type, hasChildren, collapsed, onToggle, width, height, isNew } = data;
  const color = palette[type] ?? palette.theme;

  // Create gradient based on node type
  const getGradient = () => {
    if (type === 'root') return `linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)`;
    if (type === 'chapter') return `linear-gradient(135deg, #374151 0%, #4b5563 100%)`;
    return `linear-gradient(135deg, #475569 0%, #64748b 100%)`;
  };

  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.8, x: -20 } : false}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        delay: isNew ? 0.1 : 0
      }}
      className="mindmap-node"
      data-type={type}
      style={{
        background: getGradient(),
        width,
        minHeight: height,
        height: 'auto'
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
        isConnectable={false}
      />

      <div className="mindmap-node-label">{label}</div>

      {hasChildren && (
        <motion.button
          className={`mindmap-node-toggle ${collapsed ? 'collapsed' : 'expanded'}`}
          style={{ borderColor: color, color }}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(id);
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          animate={{ rotate: collapsed ? 0 : 90 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronRight size={16} />
        </motion.button>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          right: hasChildren ? -52 : -8,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
        isConnectable={false}
      />
    </motion.div>
  );
});
MindmapNodeCard.displayName = 'MindmapNodeCard';

const nodeTypes = { mindmapNode: MindmapNodeCard };

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'bezier',
  animated: false,
  style: {
    stroke: 'rgba(148, 163, 184, 0.6)',
    strokeWidth: 2,
  },
};

// Removed getNodeSize - using calculateNodeSize instead

const buildGraph = (
  mindmap: Mindmap,
  collapsed: Set<string>,
  onToggle: (id: string) => void,
  prevNodeIds: Set<string>
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

  // Root node
  const rootChildren = childrenMap.get(rootId) ?? [];
  const rootLabel = mindmap.center_node.label;
  const rootSize = calculateNodeSize(rootLabel, 'root');
  nodes.push({
    id: rootId,
    type: 'mindmapNode',
    position: { x: 0, y: 0 },
    data: {
      label: rootLabel,
      type: 'root',
      hasChildren: rootChildren.length > 0,
      collapsed: collapsed.has(rootId),
      onToggle,
      width: rootSize.width,
      height: rootSize.height,
      isNew: !prevNodeIds.has(rootId),
    },
    draggable: false,
    selectable: false,
  });

  // Child nodes
  for (const node of mindmap.nodes) {
    if (!isVisible(node.id)) continue;
    const parentId = parentMap.get(node.id);
    if (!parentId || !isVisible(parentId)) continue;

    const nodeSize = calculateNodeSize(node.label, node.type);
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
        isNew: !prevNodeIds.has(node.id),
      },
      draggable: false,
      selectable: false,
    });

    edges.push({
      id: `${parentId}->${node.id}`,
      source: parentId,
      target: node.id,
      type: 'bezier',
      style: {
        stroke: 'rgba(148, 163, 184, 0.6)',
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
  if (nodes.length === 0) return { nodes, edges };

  const graph = {
    id: 'root',
    layoutOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: (node.data?.width ?? 280) + (node.data?.hasChildren ? 60 : 0),
      height: node.data?.height ?? 60,
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
  const [isLayouting, setIsLayouting] = useState(true);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const prevNodeIdsRef = useRef<Set<string>>(new Set());

  const toggleNode = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const graph = useMemo(
    () => buildGraph(mindmap, collapsed, toggleNode, prevNodeIdsRef.current),
    [mindmap, collapsed, toggleNode]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLayouting(true);

    (async () => {
      const { nodes: laidNodes, edges: laidEdges } = await layoutGraph(graph.nodes, graph.edges);
      if (cancelled) return;

      // Update previous node IDs for animation tracking
      prevNodeIdsRef.current = new Set(laidNodes.map(n => n.id));

      setNodes(laidNodes);
      setEdges(laidEdges);
      setIsLayouting(false);

      // Smooth fit view with animation
      if (reactFlowRef.current) {
        setTimeout(() => {
          reactFlowRef.current?.fitView({
            padding: 0.2,
            duration: 500,
            maxZoom: 1.2,
          });
        }, 100);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [graph]);

  // Loading state
  if (nodes.length === 0 && isLayouting) {
    return (
      <div className="mindmap-board">
        <div className="mindmap-loading">
          <div className="mindmap-loading-spinner" />
          <span>Building mindmap...</span>
        </div>
      </div>
    );
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
        minZoom={0.2}
        maxZoom={2}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        onInit={(instance) => {
          reactFlowRef.current = instance;
          // Initial smooth fit
          setTimeout(() => {
            instance.fitView({ padding: 0.2, duration: 600 });
          }, 200);
        }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
      >
        <Background gap={24} color="rgba(148, 163, 184, 0.15)" />
        <Controls
          showInteractive={false}
          style={{
            bottom: 20,
            left: 20,
          }}
        />
      </ReactFlow>
    </div>
  );
}
