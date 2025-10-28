'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Tree from 'react-d3-tree';
import { Mindmap, MindmapNode } from '@/types/api';
import { Download, Network } from 'lucide-react';

interface MindmapCanvasProps {
  mindmap: Mindmap;
}

interface TreeNodeDatum {
  name: string;
  attributes?: {
    nodeType: string;
    description?: string;
    timestamp?: string | null;
    id: string;
  };
  children?: TreeNodeDatum[];
  __rd3t?: {
    collapsed?: boolean;
  };
}

const NODE_COLORS: Record<string, string> = {
  root: '#4f46e5',      // Indigo-600
  topic: '#7c3aed',     // Violet-600
  decision: '#2563eb',  // Blue-600
  action: '#059669',    // Emerald-600
  achievement: '#d97706', // Amber-600
  blocker: '#dc2626',   // Red-600
  concern: '#ea580c'    // Orange-600
};

const NODE_TYPE_LABELS: Record<string, string> = {
  root: 'Meeting',
  topic: 'Topic',
  decision: 'Decision',
  action: 'Action Item',
  achievement: 'Achievement',
  blocker: 'Blocker',
  concern: 'Concern'
};

export function MindmapCanvas({ mindmap }: MindmapCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<TreeNodeDatum | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 700 });

  // Convert flat mindmap structure to hierarchical tree
  const convertToTree = useCallback((): TreeNodeDatum => {
    if (!mindmap || !mindmap.center_node) {
      return {
        name: 'No Data',
        attributes: { nodeType: 'root', id: 'root' },
        children: []
      };
    }

    // Build a map of node id to children
    const childrenMap: Record<string, MindmapNode[]> = {};

    mindmap.nodes.forEach(node => {
      if (!childrenMap[node.parent_id]) {
        childrenMap[node.parent_id] = [];
      }
      childrenMap[node.parent_id].push(node);
    });

    // Recursive function to build tree
    const buildNode = (nodeId: string, label: string, type: string, description?: string, timestamp?: string | null): TreeNodeDatum => {
      const children = childrenMap[nodeId] || [];

      return {
        name: label,
        attributes: {
          nodeType: type,
          description: description,
          timestamp: timestamp,
          id: nodeId
        },
        children: children.map(child =>
          buildNode(child.id, child.label, child.type, child.description, child.timestamp)
        )
      };
    };

    // Start from root
    return buildNode(
      mindmap.center_node.id,
      mindmap.center_node.label,
      mindmap.center_node.type
    );
  }, [mindmap]);

  const treeData = useMemo(() => convertToTree(), [convertToTree]);

  // Use ref to access tree component directly
  const treeContainerRef = React.useRef<HTMLDivElement>(null);

  // Update dimensions on mount and resize
  React.useEffect(() => {
    const updateDimensions = () => {
      if (treeContainerRef.current) {
        const { width, height } = treeContainerRef.current.getBoundingClientRect();
        setDimensions({ width: width || 800, height: height || 700 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Custom node rendering with rounded rectangles
  const renderCustomNode = useCallback(({ nodeDatum, toggleNode }: any) => {
    const nodeType = nodeDatum.attributes?.nodeType || 'topic';
    const color = NODE_COLORS[nodeType] || NODE_COLORS.topic;
    const isRoot = nodeType === 'root';
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;

    // Calculate text width for responsive box
    const padding = 20;
    const charWidth = isRoot ? 10 : 8;
    const textWidth = Math.max(150, Math.min(300, nodeDatum.name.length * charWidth + padding * 2));
    const textHeight = isRoot ? 60 : 50;
    const boxWidth = textWidth;
    const boxHeight = textHeight;

    return (
      <g>
        {/* Responsive rounded rectangle background */}
        <rect
          x={-boxWidth / 2}
          y={-boxHeight / 2}
          width={boxWidth}
          height={boxHeight}
          rx={8}
          ry={8}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
          style={{
            cursor: hasChildren ? 'pointer' : 'default',
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
            transition: 'all 0.3s ease'
          }}
          onClick={() => {
            if (hasChildren) {
              toggleNode();
            }
            setSelectedNode(nodeDatum);
          }}
        />

        {/* Node label - wrapped text */}
        <text
          fill="white"
          strokeWidth="0"
          x="0"
          y="0"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: isRoot ? '14px' : '12px',
            fontWeight: isRoot ? 'bold' : '600',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          {/* Word wrap for long labels */}
          {(() => {
            const maxCharsPerLine = isRoot ? 20 : 25;
            const words = nodeDatum.name.split(' ');
            const lines: string[] = [];
            let currentLine = '';

            words.forEach(word => {
              if ((currentLine + word).length > maxCharsPerLine && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
              } else {
                currentLine += word + ' ';
              }
            });
            if (currentLine.trim()) {
              lines.push(currentLine.trim());
            }

            // Limit to 2 lines
            const displayLines = lines.slice(0, 2);
            const lineHeight = 16;
            const startY = -(displayLines.length - 1) * (lineHeight / 2);

            return displayLines.map((line, i) => (
              <tspan key={i} x="0" y={startY + i * lineHeight}>
                {line.length > maxCharsPerLine ? line.substring(0, maxCharsPerLine - 3) + '...' : line}
              </tspan>
            ));
          })()}
        </text>

        {/* Expand/Collapse indicator */}
        {hasChildren && (
          <g>
            <circle
              cx={boxWidth / 2 - 10}
              cy={0}
              r={10}
              fill="white"
              stroke={color}
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                toggleNode();
              }}
            />
            <text
              x={boxWidth / 2 - 10}
              y={0}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={color}
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
                pointerEvents: 'none',
                userSelect: 'none'
              }}
            >
              {nodeDatum.__rd3t?.collapsed ? '+' : '−'}
            </text>
          </g>
        )}

        {/* Type badge */}
        <text
          fill="white"
          fillOpacity={0.8}
          strokeWidth="0"
          x="0"
          y={boxHeight / 2 + 15}
          textAnchor="middle"
          style={{
            fontSize: '10px',
            fontWeight: '500',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          {NODE_TYPE_LABELS[nodeType]}
        </text>
      </g>
    );
  }, []);

  // Export as PNG
  const handleExport = () => {
    const svg = document.querySelector('.mindmap-container svg');
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

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Calculate container dimensions
  const containerStyles = {
    width: '100%',
    height: '700px',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    backgroundColor: '#fafafa',
    position: 'relative' as const,
    overflow: 'hidden'
  };

  if (!mindmap || mindmap.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <Network className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-lg font-medium">No mindmap data available</p>
          <p className="text-gray-400 text-sm mt-2">Process a meeting to generate the mindmap</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">💡 Tip: Click nodes to expand/collapse. Scroll to zoom, drag to pan.</span>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span className="text-sm font-medium">Export PNG</span>
        </button>
      </div>

      {/* Mindmap Container */}
      <div style={containerStyles} className="mindmap-container" ref={treeContainerRef}>
        <Tree
          data={treeData}
          orientation="horizontal"
          pathFunc="diagonal"
          translate={{ x: 100, y: dimensions.height / 2 }}
          zoom={0.9}
          separation={{ siblings: 1.2, nonSiblings: 1.5 }}
          nodeSize={{ x: 250, y: 180 }}
          renderCustomNodeElement={renderCustomNode}
          enableLegacyTransitions={true}
          transitionDuration={400}
          depthFactor={350}
          collapsible={true}
          initialDepth={1}
          shouldCollapseNeighborNodes={false}
          zoomable={true}
          draggable={true}
          scaleExtent={{ min: 0.3, max: 2 }}
          pathClassFunc={() => 'mindmap-link'}
          styles={{
            links: {
              stroke: '#94a3b8',
              strokeWidth: 2.5,
              strokeOpacity: 0.6
            }
          }}
        />
      </div>

      {/* Selected Node Details Panel */}
      {selectedNode && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: NODE_COLORS[selectedNode.attributes?.nodeType || 'topic'] }}
              />
              <h3 className="text-lg font-semibold text-gray-900">{selectedNode.name}</h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-xl">&times;</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Type:</span>
              <span className="px-2 py-1 bg-white rounded text-sm font-medium capitalize">
                {NODE_TYPE_LABELS[selectedNode.attributes?.nodeType || 'topic']}
              </span>
            </div>

            {selectedNode.attributes?.description && (
              <div>
                <span className="text-sm font-medium text-gray-600 block mb-1">Description:</span>
                <p className="text-sm text-gray-700 leading-relaxed bg-white p-3 rounded">
                  {selectedNode.attributes.description}
                </p>
              </div>
            )}

            {selectedNode.attributes?.timestamp && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Timestamp:</span>
                <span className="px-2 py-1 bg-white rounded text-sm font-mono">
                  {selectedNode.attributes.timestamp}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Node Types</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-600 font-medium capitalize">
                {NODE_TYPE_LABELS[type]}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-300">
          <p className="text-xs text-gray-500">
            💡 <strong>Tip:</strong> Click any node to expand/collapse its children. Drag to pan, scroll to zoom. Click nodes to view full details below.
          </p>
        </div>
      </div>
    </div>
  );
}
