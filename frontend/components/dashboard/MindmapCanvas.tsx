'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Tree from 'react-d3-tree';
import { Mindmap, MindmapNode } from '@/types/api';
import { Download, ChevronDown, Network } from 'lucide-react';
import jsPDF from 'jspdf';

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
  const [dimensions, setDimensions] = useState({ width: 800, height: 700 });
  const [hoveredNode, setHoveredNode] = useState<TreeNodeDatum | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Convert flat mindmap structure to hierarchical tree
  const convertToTree = useCallback((): TreeNodeDatum => {
    if (!mindmap || !mindmap.center_node) {
      return {
        name: 'No Data',
        attributes: { nodeType: 'root', id: 'root' },
        children: []
      };
    }

    const childrenMap: Record<string, MindmapNode[]> = {};
    mindmap.nodes.forEach(node => {
      if (!childrenMap[node.parent_id]) {
        childrenMap[node.parent_id] = [];
      }
      childrenMap[node.parent_id].push(node);
    });

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

    return buildNode(
      mindmap.center_node.id,
      mindmap.center_node.label,
      mindmap.center_node.type
    );
  }, [mindmap]);

  const treeData = useMemo(() => convertToTree(), [convertToTree]);
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

  // Custom node rendering with hover support
  const renderCustomNode = useCallback(({ nodeDatum, toggleNode }: any) => {
    const nodeType = nodeDatum.attributes?.nodeType || 'topic';
    const color = NODE_COLORS[nodeType] || NODE_COLORS.topic;
    const isRoot = nodeType === 'root';
    const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;

    const padding = 20;
    const charWidth = isRoot ? 10 : 8;
    const textWidth = Math.max(150, Math.min(300, nodeDatum.name.length * charWidth + padding * 2));
    const textHeight = isRoot ? 60 : 50;
    const boxWidth = textWidth;
    const boxHeight = textHeight;

    return (
      <g
        onMouseEnter={() => setHoveredNode(nodeDatum)}
        onMouseLeave={() => setHoveredNode(null)}
      >
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

  // Track mouse position for tooltip
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Export as PNG
  const handleExportPNG = () => {
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
    setShowExportMenu(false);
  };

  // Export as JSON
  const handleExportJSON = () => {
    const jsonData = JSON.stringify(mindmap, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.download = 'meeting-mindmap.json';
    downloadLink.href = url;
    downloadLink.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // Export as PDF
  const handleExportPDF = () => {
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

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('meeting-mindmap.pdf');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    setShowExportMenu(false);
  };

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
    <div className="space-y-0">
      {/* Header with Download Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Meeting Mindmap</h2>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Download</span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {/* Dropdown Menu */}
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg transition-colors"
              >
                Download as JSON
              </button>
              <button
                onClick={handleExportPNG}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Download as PNG
              </button>
              <button
                onClick={handleExportPDF}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg transition-colors"
              >
                Download as PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mindmap Container */}
      <div style={containerStyles} className="mindmap-container" ref={treeContainerRef}>
        {/* Legend - Top Right Corner */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-gray-200 shadow-sm z-10 max-w-xs">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Node Types</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded shadow-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600 font-medium capitalize truncate">
                  {NODE_TYPE_LABELS[type]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tree Visualization */}
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

        {/* Hover Tooltip */}
        {hoveredNode && hoveredNode.attributes?.description && (
          <div
            className="fixed z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl max-w-sm pointer-events-none"
            style={{
              left: mousePos.x + 15,
              top: mousePos.y + 15
            }}
          >
            <div className="font-semibold text-sm mb-1">{hoveredNode.name}</div>
            <div className="text-xs text-gray-300 mb-2 capitalize">
              {NODE_TYPE_LABELS[hoveredNode.attributes?.nodeType || 'topic']}
            </div>
            <div className="text-xs text-gray-200 leading-relaxed">
              {hoveredNode.attributes.description}
            </div>
            {hoveredNode.attributes?.timestamp && (
              <div className="text-xs text-gray-400 mt-2">
                📍 {hoveredNode.attributes.timestamp}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
}
