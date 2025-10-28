'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Tree from 'react-d3-tree';
import { Mindmap, MindmapNode } from '@/types/api';
import { Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const [selectedNode, setSelectedNode] = useState<TreeNodeDatum | null>(null);

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

  // Custom node rendering
  const renderCustomNode = ({ nodeDatum }: any) => {
    const nodeType = nodeDatum.attributes?.nodeType || 'topic';
    const color = NODE_COLORS[nodeType] || NODE_COLORS.topic;
    const isRoot = nodeType === 'root';
    const radius = isRoot ? 50 : 35;

    return (
      <g>
        {/* Node circle */}
        <circle
          r={radius}
          fill={color}
          stroke="#fff"
          strokeWidth={3}
          style={{
            cursor: 'pointer',
            filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))'
          }}
          onClick={() => setSelectedNode(nodeDatum)}
        />

        {/* Node label */}
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
            pointerEvents: 'none'
          }}
        >
          {/* Split long labels into multiple lines */}
          {nodeDatum.name.length > 20 ? (
            <>
              <tspan x="0" dy="-0.6em">
                {nodeDatum.name.substring(0, 20)}
              </tspan>
              <tspan x="0" dy="1.2em">
                {nodeDatum.name.substring(20, 40)}
              </tspan>
              {nodeDatum.name.length > 40 && (
                <tspan x="0" dy="1.2em">
                  ...
                </tspan>
              )}
            </>
          ) : (
            nodeDatum.name
          )}
        </text>

        {/* Type badge below node */}
        <text
          fill={color}
          strokeWidth="0"
          x="0"
          y={radius + 20}
          textAnchor="middle"
          style={{
            fontSize: '10px',
            fontWeight: '500',
            pointerEvents: 'none'
          }}
        >
          {NODE_TYPE_LABELS[nodeType]}
        </text>
      </g>
    );
  };

  // Handle zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.3));
  const handleResetView = () => {
    setZoom(0.8);
    setTranslate({ x: 0, y: 0 });
  };

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
    backgroundColor: '#ffffff',
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
          <span className="text-sm font-medium text-gray-700">Controls:</span>
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4 text-gray-700" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4 text-gray-700" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            title="Reset View"
          >
            <Maximize2 className="h-4 w-4 text-gray-700" />
          </button>
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
      <div style={containerStyles} className="mindmap-container">
        <Tree
          data={treeData}
          translate={{ x: translate.x || 400, y: translate.y || 50 }}
          zoom={zoom}
          onUpdate={(state) => {
            setTranslate({ x: state.translate.x, y: state.translate.y });
            setZoom(state.zoom);
          }}
          orientation="vertical"
          pathFunc="step"
          separation={{ siblings: 1.5, nonSiblings: 2 }}
          nodeSize={{ x: 200, y: 150 }}
          renderCustomNodeElement={renderCustomNode}
          enableLegacyTransitions
          transitionDuration={500}
          depthFactor={200}
          collapsible={true}
          initialDepth={2}
          zoomable={true}
          draggable={true}
          scaleExtent={{ min: 0.3, max: 2 }}
          styles={{
            links: {
              stroke: '#94a3b8',
              strokeWidth: 2
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
                className="w-4 h-4 rounded-full shadow-sm"
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
            💡 <strong>Tip:</strong> Click and drag to pan, scroll to zoom, click nodes to see details, and click the collapse icon to expand/collapse branches.
          </p>
        </div>
      </div>
    </div>
  );
}
