'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mindmap, MindmapNode, MindmapEdge } from '@/types/api';

interface MindmapCanvasProps {
  mindmap: Mindmap;
}

interface CanvasNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  description?: string;
  timestamp?: string | null;
}

interface CanvasEdge {
  from: string;
  to: string;
  type: string;
}

const NODE_COLORS: Record<string, string> = {
  root: '#6366f1',      // Indigo
  topic: '#8b5cf6',     // Purple
  decision: '#3b82f6',  // Blue
  action: '#10b981',    // Green
  achievement: '#f59e0b', // Amber
  blocker: '#ef4444',   // Red
  concern: '#f97316'    // Orange
};

const NODE_SIZES: Record<string, number> = {
  root: 60,
  topic: 45,
  decision: 35,
  action: 30,
  achievement: 30,
  blocker: 35,
  concern: 30
};

export function MindmapCanvas({ mindmap }: MindmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<CanvasNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Convert mindmap data to canvas nodes with positions
  const buildCanvasData = () => {
    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = mindmap.edges;

    // Add center node at the center
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    nodes.push({
      id: mindmap.center_node.id,
      label: mindmap.center_node.label,
      type: mindmap.center_node.type,
      x: centerX,
      y: centerY,
      radius: NODE_SIZES.root,
      color: NODE_COLORS.root
    });

    // Group nodes by parent to calculate positions
    const nodesByParent: Record<string, MindmapNode[]> = {};
    mindmap.nodes.forEach(node => {
      if (!nodesByParent[node.parent_id]) {
        nodesByParent[node.parent_id] = [];
      }
      nodesByParent[node.parent_id].push(node);
    });

    // Recursive function to position nodes in a radial layout
    const positionNodes = (parentId: string, parentX: number, parentY: number, level: number) => {
      const children = nodesByParent[parentId] || [];
      if (children.length === 0) return;

      const radius = 150 + (level * 80); // Distance from parent
      const angleStep = (Math.PI * 2) / Math.max(children.length, 1);
      const startAngle = -Math.PI / 2; // Start from top

      children.forEach((child, index) => {
        const angle = startAngle + (angleStep * index);
        const x = parentX + Math.cos(angle) * radius;
        const y = parentY + Math.sin(angle) * radius;

        nodes.push({
          id: child.id,
          label: child.label,
          type: child.type,
          x,
          y,
          radius: NODE_SIZES[child.type] || 30,
          color: NODE_COLORS[child.type] || '#9ca3af',
          description: child.description,
          timestamp: child.timestamp
        });

        // Recursively position children of this node
        positionNodes(child.id, x, y, level + 1);
      });
    };

    // Start positioning from root
    positionNodes(mindmap.center_node.id, centerX, centerY, 1);

    return { nodes, edges };
  };

  const { nodes, edges } = buildCanvasData();

  // Handle canvas resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: width || 800, height: height || 600 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Draw the mindmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw edges first (so they appear behind nodes)
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);

      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.strokeStyle = edge.type === 'hierarchy' ? '#d1d5db' : '#9ca3af';
        ctx.lineWidth = edge.type === 'hierarchy' ? 2 : 1.5;
        if (edge.type !== 'hierarchy') {
          ctx.setLineDash([5, 5]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const isHovered = hoveredNode?.id === node.id;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#1f2937' : '#fff';
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = node.type === 'root' ? '#fff' : '#1f2937';
      ctx.font = node.type === 'root' ? 'bold 14px sans-serif' : '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Word wrap for long labels
      const maxWidth = node.radius * 1.8;
      const words = node.label.split(' ');
      let line = '';
      const lines: string[] = [];

      words.forEach(word => {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line !== '') {
          lines.push(line);
          line = word + ' ';
        } else {
          line = testLine;
        }
      });
      lines.push(line);

      const lineHeight = 14;
      const startY = node.y - ((lines.length - 1) * lineHeight) / 2;

      lines.forEach((textLine, i) => {
        ctx.fillText(textLine.trim(), node.x, startY + (i * lineHeight));
      });
    });
  }, [nodes, edges, dimensions, hoveredNode]);

  // Handle mouse move for hover effect
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x: e.clientX, y: e.clientY });

    // Check if hovering over any node
    const hoveredNode = nodes.find(node => {
      const distance = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
      return distance <= node.radius;
    });

    setHoveredNode(hoveredNode || null);
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
  };

  const handleMouseLeave = () => {
    setHoveredNode(null);
  };

  if (!mindmap || mindmap.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">No mindmap data available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
        style={{ height: '600px' }}
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full"
        />
      </div>

      {/* Tooltip for hovered node */}
      {hoveredNode && (
        <div
          className="fixed z-50 bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg max-w-xs pointer-events-none"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y + 15
          }}
        >
          <div className="font-semibold text-sm mb-1">{hoveredNode.label}</div>
          <div className="text-xs text-gray-300 capitalize mb-1">Type: {hoveredNode.type}</div>
          {hoveredNode.description && (
            <div className="text-xs text-gray-200 mt-1">{hoveredNode.description}</div>
          )}
          {hoveredNode.timestamp && (
            <div className="text-xs text-gray-400 mt-1">Time: {hoveredNode.timestamp}</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
