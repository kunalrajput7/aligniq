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
} from 'reactflow';
import type { ReactFlowInstance } from 'reactflow';
import ELK from 'elkjs/lib/elk.bundled.js';
import 'reactflow/dist/style.css';
import { Mindmap, MindmapNode } from '@/types/api';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
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
  root: { width: 280, height: 96 },
  theme: { width: 240, height: 90 },
  chapter: { width: 230, height: 86 },
  claim: { width: 220, height: 82 },
  action: { width: 230, height: 86 },
  achievement: { width: 230, height: 86 },
  blocker: { width: 230, height: 86 },
  decision: { width: 230, height: 86 },
  concern: { width: 230, height: 86 },
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

const MindmapNodeCard = memo<NodeProps<NodeData>>(({ data, id }) => {
  const { label, type, hasChildren, collapsed, onToggle, width, height } = data;
  const color = palette[type] ?? palette.theme;
  const gradient = `linear-gradient(135deg, ${color}F2, ${color}D0)`;
  const borderColor = `${color}80`;

  return (
    <div
      className="mindmap-node"
      data-type={type}
      style={{ background: gradient, borderColor, width, minHeight: height }}
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

const edgeOptions = {
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
  pathOptions: {
    borderRadius: 80,
  },
};

const getNodeSize = (type: string) => NODE_SIZE[type] ?? NODE_SIZE.claim;

const buildGraph = (
  mindmap: Mindmap,
  collapsed: Set<string>,
  onToggle: (id: string) => void
) => {
  const rootId = mindmap.center_node.id;
  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, MindmapNode[]>();

  mindmap.nodes.forEach((node) => {
    parentMap.set(node.id, node.parent_id);
    childrenMap.set(node.parent_id, [
      ...(childrenMap.get(node.parent_id) || []),
      node,
    ]);
  });

  const depthMap = new Map<string, number>([[rootId, 0]]);
  const queue: string[] = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    const children = childrenMap.get(current) || [];
    children.forEach((child) => {
      depthMap.set(child.id, (depthMap.get(current) ?? 0) + 1);
      queue.push(child.id);
    });
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

  const rootChildren = childrenMap.get(rootId) || [];
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

  mindmap.nodes.forEach((node) => {
    if (!isVisible(node.id)) return;
    const parentId = parentMap.get(node.id);
    if (!parentId || !isVisible(parentId)) return;

    const nodeSize = getNodeSize(node.type);
    const hasChildren = (childrenMap.get(node.id) || []).length > 0;

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
      ...edgeOptions,
    });
  });

  return { nodes, edges };
};

const layoutGraph = async (nodes: Node<NodeData>[], edges: Edge[]) => {
  const graph = {
    id: 'root',
    layoutOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: node.data.width + (node.data.hasChildren ? 80 : 0),
      height: node.data.height,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const { children } = await elk.layout(graph);
  const positions = Object.fromEntries(
    children.map((child: any) => [
      child.id,
      { x: child.x ?? 0, y: child.y ?? 0 },
    ])
  );

  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
  }));

  return { nodes: positionedNodes, edges };
};

export function MindmapCanvas({ mindmap }: MindmapCanvasProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);

  const toggleNode = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const graph = useMemo(
    () => buildGraph(mindmap, collapsed, toggleNode),
    [mindmap, collapsed, toggleNode]
  );

  useEffect(() => {
    let cancelled = false;
    layoutGraph(graph.nodes, graph.edges).then(({ nodes, edges }) => {
      if (cancelled) return;
      setNodes(nodes);
      setEdges(edges);
      if (reactFlowRef.current) {
        requestAnimationFrame(() =>
          reactFlowRef.current?.fitView({ padding: 0.25, duration: 420 })
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [graph]);

  const handleExportPNG = () => {
    const svg = document.querySelector('.mindmap-board svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = 'meeting-mindmap.png';
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src =
      'data:image/svg+xml;base64,' +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleExportJSON = () => {
    const jsonData = JSON.stringify(mindmap, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.download = 'meeting-mindmap.json';
    downloadLink.href = url;
    downloadLink.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const svg = document.querySelector('.mindmap-board svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        canvas.width,
        canvas.height
      );
      pdf.save('meeting-mindmap.pdf');
    };
    img.src =
      'data:image/svg+xml;base64,' +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="mindmap-board">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={edgeOptions}
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
        onPaneClick={() => setMenuOpen(false)}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        onWheel={(event) => {
          if (event.ctrlKey) return;
          event.preventDefault();
          const instance = reactFlowRef.current;
          if (!instance) return;
          const currentZoom = instance.getZoom();
          const delta = event.deltaY > 0 ? -0.18 : 0.18;
          const nextZoom = Math.min(2.5, Math.max(0.35, currentZoom + delta));
          instance.zoomTo(nextZoom, {
            duration: 180,
            easing: (t) => 1 - Math.pow(1 - t, 3),
            x: event.clientX,
            y: event.clientY,
          });
        }}
      >
        <Background gap={28} color="#d9e0ff" />
        <div className="absolute top-4 right-4 bg-white/70 backdrop-blur-md p-3 rounded-lg border border-gray-200 shadow-sm z-10 max-w-xs">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Node Types</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(palette).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded shadow-sm flex-shrink-0"
                  style={{
                    background: `linear-gradient(90deg, ${color} 0%, ${color}aa 100%)`,
                  }}
                />
                <span className="text-xs text-gray-600 font-medium capitalize truncate">
                  {type}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 z-20">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md shadow-lg hover:bg-indigo-700 transition-colors"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Download</span>
          </button>
          <div
            className={`mindmap-download-menu ${
              menuOpen ? 'open' : ''
            } absolute bottom-12 right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden`}
          >
            <button
              onClick={() => {
                handleExportJSON();
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Download as JSON
            </button>
            <button
              onClick={() => {
                handleExportPNG();
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Download as PNG
            </button>
            <button
              onClick={() => {
                handleExportPDF();
                setMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Download as PDF
            </button>
          </div>
        </div>
      </ReactFlow>
    </div>
  );
}
